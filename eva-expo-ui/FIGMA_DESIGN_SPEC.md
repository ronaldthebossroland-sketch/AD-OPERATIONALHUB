# EVA Figma Design Spec

## Product

Executive Virtual Assistant is a Jarvis-style executive AI assistant for operations, meetings, decisions, transcripts, and daily workflow.

## Frame

- Mobile frame: 393 x 852
- Safe area top: 44
- Bottom navigation height: 78
- Screen padding: 20
- Card radius: 24
- Chip radius: 999
- Base spacing unit: 4
- Primary spacing scale: 8, 12, 16, 20, 24, 32

## Color System

### 60 Percent Base

- `#060B18` Ink Navy
- `#091225` Executive Navy
- `#0E1830` Deep Panel

### 30 Percent Surface

- `#111E38` Card
- `#162645` Elevated Card
- `#1D3158` Control Surface

### 10 Percent Accent

- `#38BDF8` Electric Blue
- `#7C3AED` Soft Violet

### Status

- High risk: `#FB7185`
- Needs attention: `#FBBF24`
- Stable: `#34D399`

### Text

- Primary: `#F8FAFC`
- Secondary: `#AAB7D4`
- Muted: `#7180A6`

## Typography

- Font family: Inter or SF Pro
- Display: 30 / 36, weight 800
- H1: 24 / 31, weight 800
- H2: 18 / 24, weight 700
- Body: 15 / 22, weight 500
- Caption: 12 / 16, weight 600
- Micro: 10 / 14, weight 700

## Reusable Components

### App Shell

Full-screen deep navy gradient with subtle radial glow accents. Bottom navigation remains fixed.

### Glow Card

Dark elevated card with low-opacity border, soft blue shadow, 24 radius.

### Command Input

Rounded input field with electric blue glow. Includes leading sparkle icon and placeholder text.

### Prompt Chip

Compact rounded chip for suggested prompts. Uses dark surface, muted border, blue active icon.

### Status Pill

Small label with status color dot. Variants: high, attention, stable, neutral.

### Floating Mic

Large circular button with electric blue inner gradient and violet outer glow.

### Bottom Nav

Five items: EVA, Calendar, Operations, Transcripts, Settings. Active item uses blue glow and brighter text.

## Screens

### EVA Assistant

Purpose: brain.

Content:

- Header: Good evening, Ronald
- Status: EVA is ready
- Main command input
- Suggested prompts
- Modern chat bubbles
- AI typing indicator
- Floating mic button

### Calendar

Purpose: time.

Content:

- Today timeline
- Upcoming meetings
- Smart scheduling suggestion: You have a 2-hour gap available
- Clean event cards

### Operations

Purpose: execution.

Content:

- High-risk items
- Needs attention
- Stable operations
- Priority cards with red, amber, and green indicators

### Transcripts

Purpose: memory.

Content:

- Record button
- Live transcription panel
- AI summary card
- Extracted action items
- Add to Operations button

### Settings

Purpose: control.

Content:

- Profile
- Notifications
- Voice settings
- AI behavior
- Logout
