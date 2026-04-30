import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Mic, RefreshCw, Save, Square } from "lucide-react";

import {
  createTranscriptionSession,
  createTranscript,
  extractTranscriptActions,
  getTranscripts,
  TRANSCRIPTION_WS_URL,
  updateTranscript,
} from "../../services/api";
import SectionHeader from "../shared/SectionHeader";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

function float32ToInt16Buffer(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);

  for (let index = 0; index < float32Array.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, float32Array[index]));
    view.setInt16(
      index * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true
    );
  }

  return buffer;
}

function parseSocketMessage(event) {
  try {
    return JSON.parse(event.data);
  } catch {
    return {
      type: "error",
      error: "Unexpected transcription message from the backend.",
    };
  }
}

export default function TranscriptsView({ autoStartKey = 0 }) {
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [savedTranscripts, setSavedTranscripts] = useState([]);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState(null);
  const [lastSavedTranscriptId, setLastSavedTranscriptId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState(null);
  const [status, setStatus] = useState("Ready to record.");

  const mediaStreamRef = useRef(null);
  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const gainRef = useRef(null);
  const autoStartHandledRef = useRef(0);

  const displayedTranscript = interimTranscript
    ? `${transcript}${transcript ? " " : ""}${interimTranscript}`
    : transcript;

  const closeAudioGraph = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
    }

    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    gainRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    gainRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;

    if (audioContext && audioContext.state !== "closed") {
      audioContext.close().catch(() => {});
    }
  }, []);

  const closeRecordingResources = useCallback(() => {
    closeAudioGraph();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send("stop");
      socketRef.current.close();
    } else if (socketRef.current?.readyState === WebSocket.CONNECTING) {
      socketRef.current.close();
    }

    socketRef.current = null;
  }, [closeAudioGraph]);

  async function loadTranscripts() {
    try {
      const data = await getTranscripts();

      if (!data.ok) {
        setStatus(data.error || "Could not load transcripts.");
        return;
      }

      setSavedTranscripts(data.transcripts || []);
    } catch {
      setStatus("Could not reach the transcripts API.");
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => loadTranscripts());

    return () => {
      closeRecordingResources();
    };
  }, [closeRecordingResources]);

  const appendFinalTranscript = useCallback((text) => {
    setTranscript((previous) => {
      const cleanPrevious = previous.trim();
      const cleanText = text.trim();

      if (!cleanText) {
        return previous;
      }

      return cleanPrevious ? `${cleanPrevious} ${cleanText}` : cleanText;
    });
    setInterimTranscript("");
  }, []);

  const startRecording = useCallback(async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!navigator.mediaDevices?.getUserMedia || !AudioContextClass) {
      setStatus("Microphone recording is not supported in this browser.");
      return;
    }

    try {
      setSelectedTranscriptId(null);
      setStatus("Requesting microphone access...");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const audioContext = new AudioContextClass();
      await audioContext.resume();
      const sampleRate = audioContext.sampleRate;

      setStatus("Opening transcription session...");

      const sessionData = await createTranscriptionSession(sampleRate);

      if (!sessionData.ok || !sessionData.ticket) {
        closeRecordingResources();
        setStatus(
          sessionData.error ||
            "Could not authorize the transcription WebSocket."
        );
        return;
      }

      const socket = new WebSocket(
        `${TRANSCRIPTION_WS_URL}?ticket=${encodeURIComponent(sessionData.ticket)}`
      );

      socketRef.current = socket;
      mediaStreamRef.current = stream;
      audioContextRef.current = audioContext;

      socket.onopen = () => {
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        const gain = audioContext.createGain();

        gain.gain.value = 0;

        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0);

          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(float32ToInt16Buffer(input));
          }
        };

        source.connect(processor);
        processor.connect(gain);
        gain.connect(audioContext.destination);

        sourceRef.current = source;
        processorRef.current = processor;
        gainRef.current = gain;
        setIsRecording(true);
        setStatus(`Recording live audio at ${sampleRate}Hz...`);
      };

      socket.onmessage = (event) => {
        const message = parseSocketMessage(event);

        if (message.type === "ready") {
          setStatus("Deepgram stream connected.");
          return;
        }

        if (message.type === "transcript") {
          if (message.isFinal) {
            appendFinalTranscript(message.text);
          } else {
            setInterimTranscript(message.text);
          }
          return;
        }

        if (message.type === "error") {
          setStatus(message.error || "Transcription stream failed.");
        }
      };

      socket.onerror = () => {
        setStatus("WebSocket transcription connection failed.");
      };

      socket.onclose = () => {
        closeAudioGraph();
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        socketRef.current = null;
        setIsRecording(false);
        setInterimTranscript("");
      };
    } catch {
      closeRecordingResources();
      setIsRecording(false);
      setStatus("Could not start recording. Check microphone permission.");
    }
  }, [appendFinalTranscript, closeAudioGraph, closeRecordingResources]);

  useEffect(() => {
    if (
      !autoStartKey ||
      isRecording ||
      autoStartHandledRef.current === autoStartKey
    ) {
      return undefined;
    }

    autoStartHandledRef.current = autoStartKey;
    const timeoutId = window.setTimeout(() => startRecording(), 250);

    return () => window.clearTimeout(timeoutId);
  }, [autoStartKey, isRecording, startRecording]);

  function stopRecording() {
    closeRecordingResources();
    setIsRecording(false);
    setStatus("Recording stopped.");
  }

  async function saveTranscript() {
    const finalTranscript = displayedTranscript.trim();

    if (!finalTranscript) {
      setStatus("Transcript text is required before saving.");
      return;
    }

    try {
      setIsSaving(true);
      setStatus("Saving transcript...");

      const payload = {
        title: title.trim() || "Untitled transcript",
        transcript: finalTranscript,
      };

      const isUpdatingSavedTranscript = Boolean(selectedTranscriptId);
      const data = isUpdatingSavedTranscript
        ? await updateTranscript(selectedTranscriptId, payload)
        : await createTranscript(payload);

      if (!data.ok) {
        setStatus(data.error || "Could not save transcript.");
        return;
      }

      setSelectedTranscriptId(isUpdatingSavedTranscript ? data.transcript.id : null);
      setLastSavedTranscriptId(data.transcript.id);
      setTitle(data.transcript.title || "");
      setTranscript(data.transcript.transcript || "");
      setInterimTranscript("");
      setExtractionResult(null);
      setStatus(
        isUpdatingSavedTranscript ? "Transcript updated." : "Transcript saved."
      );
      await loadTranscripts();
    } catch {
      setStatus("Could not reach the transcripts API.");
    } finally {
      setIsSaving(false);
    }
  }

  function openSavedTranscript(item) {
    setSelectedTranscriptId(item.id);
    setLastSavedTranscriptId(item.id);
    setTitle(item.title || "");
    setTranscript(item.transcript || "");
    setInterimTranscript("");
    setExtractionResult(null);
    setStatus("Saved transcript loaded for editing.");
  }

  function startNewTranscript() {
    setSelectedTranscriptId(null);
    setLastSavedTranscriptId(null);
    setTitle("");
    setTranscript("");
    setInterimTranscript("");
    setExtractionResult(null);
    setStatus("Ready for a new transcript.");
  }

  async function extractActions() {
    const transcriptId = selectedTranscriptId || lastSavedTranscriptId;

    if (!transcriptId) {
      setStatus("Save or load a transcript before extracting actions.");
      return;
    }

    try {
      setIsExtracting(true);
      setStatus("Extracting actions from transcript...");

      const data = await extractTranscriptActions(transcriptId);

      if (!data.ok) {
        setStatus(data.error || "Could not extract transcript actions.");
        return;
      }

      setExtractionResult(data);
      setStatus(
        `Extracted ${data.tasks?.length || 0} tasks and ${
          data.alarms?.length || 0
        } reminders.`
      );
    } catch {
      setStatus("Could not reach the transcript extraction API.");
    } finally {
      setIsExtracting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="xl:col-span-8">
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={Mic}
              title="Meeting Transcription"
              subtitle="Record live audio through the backend Deepgram stream"
              action={
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={startRecording}
                    disabled={isRecording}
                    className="rounded-2xl"
                  >
                    <Mic className="mr-2 h-4 w-4" />
                    Record
                  </Button>
                  <Button
                    onClick={stopRecording}
                    disabled={!isRecording}
                    variant="outline"
                    className="rounded-2xl"
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                </div>
              }
            />

            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Transcript title"
              className="mb-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
            />

            <textarea
              value={displayedTranscript}
              onChange={(event) => {
                setTranscript(event.target.value);
                setInterimTranscript("");
              }}
              placeholder="Live transcript will appear here..."
              className="min-h-[24rem] w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 outline-none focus:border-slate-400"
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                onClick={saveTranscript}
                disabled={isSaving}
                className="rounded-2xl"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving
                  ? "Saving..."
                  : selectedTranscriptId
                    ? "Update Transcript"
                    : "Save Transcript"}
              </Button>
              <Button
                onClick={startNewTranscript}
                variant="outline"
                className="rounded-2xl"
              >
                New Transcript
              </Button>
              <Button
                onClick={extractActions}
                disabled={isExtracting || !(selectedTranscriptId || lastSavedTranscriptId)}
                variant="outline"
                className="rounded-2xl"
              >
                <FileText className="mr-2 h-4 w-4" />
                {isExtracting ? "Extracting..." : "Extract Actions"}
              </Button>
              <p className="text-sm font-bold text-slate-600">{status}</p>
            </div>

            {extractionResult && (
              <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <h3 className="font-black text-slate-950">
                  Extracted Actions
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Saved {extractionResult.tasks?.length || 0} tasks and{" "}
                  {extractionResult.alarms?.length || 0} reminders from this
                  transcript.
                </p>
                {extractionResult.decisions?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {extractionResult.decisions.slice(0, 3).map((decision) => (
                      <p
                        key={decision}
                        className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600"
                      >
                        {decision}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="xl:col-span-4">
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <SectionHeader
              icon={FileText}
              title="Saved Transcripts"
              subtitle="Load and edit previous meeting transcripts"
              action={
                <Button
                  onClick={loadTranscripts}
                  variant="outline"
                  className="rounded-2xl"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              }
            />

            {savedTranscripts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <FileText className="mx-auto h-7 w-7 text-slate-400" />
                <p className="mt-3 text-sm font-bold text-slate-600">
                  No transcripts saved yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedTranscripts.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => openSavedTranscript(item)}
                    className={`w-full rounded-3xl border p-4 text-left transition hover:bg-slate-50 ${
                      selectedTranscriptId === item.id
                        ? "border-slate-950"
                        : "border-slate-100"
                    }`}
                  >
                    <h3 className="font-black text-slate-950">
                      {item.title || "Untitled transcript"}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
                      {item.transcript}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
