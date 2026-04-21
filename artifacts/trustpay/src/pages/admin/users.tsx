import React, { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminGetUsers, useAdminUpdateUserBalance, useAdminUpdateUser } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminGetUsersQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, Pencil, ShieldOff, ShieldCheck } from "lucide-react";
import { getAuthToken } from "@/lib/auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

async function api(path: string, opts: RequestInit = {}) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useAdminGetUsers();
  const updateBalanceMutation = useAdminUpdateUserBalance();

  const [editUser, setEditUser] = useState<any>(null);
  const [newBalance, setNewBalance] = useState("");
  const [reason, setReason] = useState("");
  const [deleteUser, setDeleteUser] = useState<any>(null);
  const [renameUser, setRenameUser] = useState<any>(null);
  const [renameUsername, setRenameUsername] = useState("");
  const [renameDisplayName, setRenameDisplayName] = useState("");
  const updateUserMut = useAdminUpdateUser();
  const [unsuspendUser, setUnsuspendUser] = useState<any>(null);
  const [unsuspendLoading, setUnsuspendLoading] = useState(false);

  const handleUnsuspend = async () => {
    if (!unsuspendUser) return;
    setUnsuspendLoading(true);
    try {
      await api(`/admin/users/${unsuspendUser.id}/unfreeze`, { method: "POST" });
      toast({ title: `${unsuspendUser.username} unsuspend ho gaya` });
      setUnsuspendUser(null);
      queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUnsuspendLoading(false);
    }
  };

  const openEdit = (user: any) => {
    setEditUser(user);
    setNewBalance(user.balance.toString());
    setReason("Admin adjustment");
  };

  const handleSaveBalance = () => {
    if (!editUser) return;
    updateBalanceMutation.mutate({
      id: editUser.id,
      data: {
        balance: parseFloat(newBalance),
        reason: reason,
      }
    }, {
      onSuccess: () => {
        toast({ title: "User balance updated" });
        setEditUser(null);
        queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update", variant: "destructive" });
      }
    });
  };

  const openRename = (user: any) => {
    setRenameUser(user);
    setRenameUsername(user.username || "");
    setRenameDisplayName(user.displayName || "");
  };

  const handleSaveRename = () => {
    if (!renameUser) return;
    updateUserMut.mutate({
      id: renameUser.id,
      data: { username: renameUsername.trim(), displayName: renameDisplayName.trim() },
    }, {
      onSuccess: () => {
        toast({ title: "User renamed" });
        setRenameUser(null);
        queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.message || "Rename failed", variant: "destructive" });
      },
    });
  };

  const handleDeleteUser = () => {
    if (!deleteUser) return;
    api(`/admin/users/${deleteUser.id}`, { method: "DELETE" }).then(() => {
      toast({ title: "User removed" });
      setDeleteUser(null);
      queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
    }).catch((err: any) => {
      toast({ title: "Error", description: err.message || "Failed to delete user", variant: "destructive" });
    });
  };

  const suspendedUsers = (users as any[] || []).filter((u: any) => u.isFrozen);
  const activeUsers = (users as any[] || []).filter((u: any) => !u.isFrozen);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Manage Users</h1>

        {/* Suspended Users Section */}
        {suspendedUsers.length > 0 && (
          <Card className="border-red-300 bg-red-50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <ShieldOff className="h-5 w-5 text-red-600" />
                  <h2 className="font-bold text-red-700 text-lg">Suspended Users ({suspendedUsers.length})</h2>
                </div>
                <Badge className="bg-red-600 hover:bg-red-600">Needs action</Badge>
              </div>
              <div className="space-y-2">
                {suspendedUsers.map((user: any) => (
                  <div key={user.id} className="flex items-center justify-between gap-3 bg-white border border-red-200 rounded-2xl px-4 py-3">
                    <div>
                      <div className="font-semibold text-sm">{user.username}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>Trust Score: <span className="font-bold text-red-600">{user.trustScore ?? 0}</span></span>
                        <span>·</span>
                        <span>Balance: ₹{Number(user.balance).toFixed(2)}</span>
                        {user.phone && <><span>·</span><span>{user.phone}</span></>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-4"
                      onClick={() => setUnsuspendUser(user)}
                    >
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Unsuspend
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Username / Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Deposits / Withdrawals</TableHead>
                    <TableHead>Invite Earnings</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center">Loading...</TableCell>
                    </TableRow>
                  ) : activeUsers.length > 0 ? (
                    activeUsers.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.id}</TableCell>
                        <TableCell>
                          <div className="font-medium">{user.username}</div>
                          {user.phone && <div className="text-xs text-muted-foreground">{user.phone}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-primary">₹{user.balance.toFixed(2)}</TableCell>
                        <TableCell className="text-xs space-y-1">
                          <div>Dep: ₹{user.totalDeposits.toFixed(2)}</div>
                          <div>With: ₹{user.totalWithdrawals.toFixed(2)}</div>
                        </TableCell>
                        <TableCell className="text-xs space-y-1">
                          <div className="text-purple-700 font-medium">L1: ₹{(user.inviteEarnings || 0).toFixed(2)}</div>
                          <div className="text-blue-600">L2: ₹{(user.inviteEarningsL2 || 0).toFixed(2)}</div>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{user.referralCode || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {user.createdAt ? format(new Date(user.createdAt), "MMM dd, yyyy") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openRename(user)}>
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Rename
                            </Button>
                            {user.isFrozen ? (
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setUnsuspendUser(user)}>
                                <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Unsuspend
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={async () => {
                                  try {
                                    await api(`/admin/users/${user.id}/freeze`, { method: "POST" });
                                    toast({ title: `${user.username} suspended` });
                                    queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
                                  } catch (err: any) {
                                    toast({ title: "Error", description: err.message, variant: "destructive" });
                                  }
                                }}
                              >
                                <ShieldOff className="h-3.5 w-3.5 mr-1" /> Suspend
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => openEdit(user)}>
                              Edit Balance
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (user.role === "admin") {
                                  toast({ title: "Admin users cannot be deleted", variant: "destructive" });
                                  return;
                                }
                                setDeleteUser(user);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No users found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Balance for {editUser?.username}</DialogTitle>
            <DialogDescription>Current balance: ₹{editUser?.balance.toFixed(2)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Balance (₹)</label>
              <Input
                type="number"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for adjustment</label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Manual correction"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleSaveBalance} disabled={updateBalanceMutation.isPending}>Save Balance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameUser} onOpenChange={(open) => !open && setRenameUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {renameUser?.username}</DialogTitle>
            <DialogDescription>Change username and/or display name. Username must be unique.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <Input value={renameUsername} onChange={(e) => setRenameUsername(e.target.value)} placeholder="username" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Display Name (optional)</label>
              <Input value={renameDisplayName} onChange={(e) => setRenameDisplayName(e.target.value)} placeholder="Shown in chats and orders" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameUser(null)}>Cancel</Button>
            <Button onClick={handleSaveRename} disabled={updateUserMut.isPending || !renameUsername.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {deleteUser?.username}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!unsuspendUser} onOpenChange={(open) => !open && setUnsuspendUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" /> Unsuspend karna hai?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{unsuspendUser?.username}</span> ka account suspend se normal ho jayega. Woh phir se sell/buy kar sakta hai.
              <br />
              <span className="text-xs text-muted-foreground">Trust Score: {unsuspendUser?.trustScore ?? 0}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unsuspendLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={handleUnsuspend}
              disabled={unsuspendLoading}
            >
              {unsuspendLoading ? "Processing..." : "Haan, Unsuspend Karo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
