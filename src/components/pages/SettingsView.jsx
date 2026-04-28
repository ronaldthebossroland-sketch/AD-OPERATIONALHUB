import { useEffect, useState } from "react";
import {
  Settings,
  UserPlus,
  ShieldCheck,
  Mail,
  Brain,
  Trash2,
  RefreshCw,
} from "lucide-react";
import {
  APP_HOME_URL,
  createUser,
  deleteUser,
  getCurrentUser,
  getUsers,
  GOOGLE_AUTH_URL,
  logoutUser,
} from "../../services/api";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";

export default function SettingsView() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("Viewer");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadUsers() {
    try {
      setLoading(true);

      const data = await getUsers();

      if (data.users) {
        setUsers(data.users.filter((user) => user.is_active === 1));
      } else {
        setMessage(data.error || "Could not load users.");
      }
    } catch {
      setMessage("Could not connect to user database.");
    } finally {
      setLoading(false);
    }
  }

  async function addUser() {
    if (!newUserEmail.trim()) {
      setMessage("Please enter an email address.");
      return;
    }

    try {
      setLoading(true);

      const data = await createUser({
        name: newUserName || "Pending User",
        email: newUserEmail.trim().toLowerCase(),
        role: newUserRole,
        access: newUserRole === "Admin" ? "Full Access" : "Limited Access",
      });

      if (!data.ok) {
        setMessage(data.error || "Could not add user.");
        return;
      }

      setNewUserEmail("");
      setNewUserName("");
      setNewUserRole("Viewer");
      setMessage("User added successfully.");
      loadUsers();
    } catch {
      setMessage("Could not add user.");
    } finally {
      setLoading(false);
    }
  }

  async function removeUser(id) {
    try {
      setLoading(true);

      const data = await deleteUser(id);

      if (!data.ok) {
        setMessage(data.error || "Could not remove user.");
        return;
      }

      setMessage("User removed successfully.");
      loadUsers();
    } catch {
      setMessage("Could not remove user.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await logoutUser();
    window.location.href = APP_HOME_URL;
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const currentUserData = await getCurrentUser();

        if (isMounted) {
          setCurrentUser(currentUserData.user);
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null);
        }
      }

      try {
        const usersData = await getUsers();

        if (!isMounted) {
          return;
        }

        if (usersData.users) {
          setUsers(usersData.users.filter((user) => user.is_active === 1));
        } else {
          setMessage(usersData.error || "Could not load users.");
        }
      } catch {
        if (isMounted) {
          setMessage("Could not connect to user database.");
        }
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="xl:col-span-8">
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-3">
                  <Settings className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    Access Settings
                  </h2>
                  <p className="text-sm text-slate-500">
                    Manage real users who can access the AD Operational Hub.
                  </p>
                </div>
              </div>

              <Button
                onClick={loadUsers}
                variant="outline"
                className="rounded-2xl"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <label className="text-sm font-bold text-slate-700">
                Add authorized user
              </label>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <input
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Full name"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                />

                <input
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                />

                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                >
                  <option value="Viewer">Viewer</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              <Button
                onClick={addUser}
                disabled={loading}
                className="mt-3 rounded-2xl"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {loading ? "Saving..." : "Add User"}
              </Button>

              {message && (
                <p className="mt-3 rounded-2xl bg-white p-3 text-sm text-slate-600">
                  {message}
                </p>
              )}
            </div>

            <div className="mt-6 space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-100 p-5 md:flex-row md:items-center"
                >
                  <div>
                    <h3 className="font-black text-slate-950">
                      {user.name || "Pending User"}
                    </h3>
                    <p className="text-sm text-slate-500">{user.email}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {user.role}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        {user.access}
                      </span>
                    </div>
                  </div>

                  {user.role !== "Super Admin" && (
                    <Button
                      onClick={() => removeUser(user.id)}
                      variant="outline"
                      className="rounded-2xl text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 xl:col-span-4">
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-slate-700" />
              <div>
                <h2 className="font-black text-slate-950">Current User</h2>
                <p className="text-sm text-slate-500">Login status</p>
              </div>
            </div>

            {currentUser ? (
              <div className="space-y-3">
                <div className="rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-800">
                  <strong>{currentUser.name}</strong>
                  <br />
                  {currentUser.email}
                </div>

                <div className="rounded-3xl bg-blue-50 p-4 text-sm text-blue-800">
                  <strong>Role:</strong> {currentUser.role}
                </div>

                <Button
                  onClick={logout}
                  variant="outline"
                  className="w-full rounded-2xl"
                >
                  Logout
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-3xl bg-amber-50 p-4 text-sm text-amber-800">
                  You are not logged in.
                </div>

                <Button
                  onClick={() => (window.location.href = GOOGLE_AUTH_URL)}
                  className="w-full rounded-2xl"
                >
                  Login with Google
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <Brain className="h-6 w-6 text-slate-700" />
              <div>
                <h2 className="font-black text-slate-950">AI Status</h2>
                <p className="text-sm text-slate-500">OpenAI connection</p>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
              AI backend is connected. OpenAI responses require active API
              billing.
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <Mail className="h-6 w-6 text-slate-700" />
              <div>
                <h2 className="font-black text-slate-950">Email Access</h2>
                <p className="text-sm text-slate-500">Gmail integration</p>
              </div>
            </div>

            <div className="rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-800">
              Gmail OAuth is active. Every authorized user must connect their
              own Gmail account.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
