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
import { Trash2, Pencil, ShieldOff, ShieldCheck, Star, RefreshCw, BlocksIcon, Info } from "lucide-react";
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
  const [freezeReasonUser, setFreezeReasonUser] = useState<any>(null);
  const [freezeReason, setFreezeReason] = useState("");
  const [freezeWithReasonLoading, setFreezeWithReasonLoading] = useState(false);
  const [blockUser, setBlockUser] = useState<any>(null);
  const [blockTargetId, setBlockTargetId] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockLoading, setBlockLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const markTrusted = async (user: any, isTrusted: boolean) => {
    setActionLoading(`trust-${user.id}`);
    try {
      await api(`/admin/users/${user.id}/trust`, { method: "POST", body: JSON.stringify({ isTrusted }) });
      toast({ title: isTrusted ? `${user.username} marked Trusted` : `Trust removed from ${user.username}` });
      queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const resetWarnings = async (user: any) => {
    if (!confirm(`Reset fraud warning count for ${user.username}?`)) return;
    setActionLoading(`warn-${user.id}`);
    try {
      await api(`/admin/users/${user.id}/reset-fraud-warnings`, { method: "POST" });
      toast({ title: `Warnings reset for ${user.username}` });
      queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleFreezeWithReason = async () => {
    if (!freezeReasonUser) return;
    setFreezeWithReasonLoading(true);
    try {
      await api(`/admin/users/${freezeReasonUser.id}/freeze`, { method: "POST", body: JSON.stringify({ reason: freezeReason.trim() || undefined }) });
      toast({ title: `${freezeReasonUser.username} frozen` });
      setFreezeReasonUser(null); setFreezeReason("");
      queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setFreezeWithReasonLoading(false);
    }
  };

  const handleAddBlock = async () => {
    if (!blockUser || !blockTargetId.trim()) return;
    const userId2 = parseInt(blockTargetId.trim());
    if (isNaN(userId2) || userId2 === blockUser.id) {
      toast({ title: "Enter a valid, different user ID", variant: "destructive" });
      return;
    }
    setBlockLoading(true);
    try {
      await api("/admin/trade-pair-blocks", { method: "POST", body: JSON.stringify({ userId1: blockUser.id, userId2, reason: blockReason.trim() || undefined }) });
      toast({ title: `Trade pair block added: ${blockUser.username} ↔ User #${userId2}` });
      setBlockUser(null); setBlockTargetId(""); setBlockReason("");
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBlockLoading(false);
    }
  };

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

        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800">
              <strong>Suspend</strong> — freezes the user's account (they can't lock orders). You can optionally add a reason.
              <strong className="ml-1">Mark Trusted</strong> — flags a user so the fraud engine won't auto-freeze them.
              <strong className="ml-1">Reset Warnings</strong> — clears their fraud warning counter back to zero.
              <strong className="ml-1">Block Trade</strong> — prevents a user from buying or selling on one specific side.
              <strong className="ml-1">Edit Balance</strong> — adjusts their wallet balance; all adjustments are logged.
            </p>
          </CardContent>
        </Card>

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
                          <div className="font-medium flex items-center gap-1">
                            {user.username}
                            {user.isTrusted && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" aria-label="Trusted User" />}
                          </div>
                          {user.phone && <div className="text-xs text-muted-foreground">{user.phone}</div>}
                          {user.freezeReason && <div className="text-[10px] text-red-500 mt-0.5">Reason: {user.freezeReason}</div>}
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
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => openRename(user)}>
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Rename
                            </Button>
                            {user.isFrozen ? (
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setUnsuspendUser(user)}>
                                <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Unsuspend
                              </Button>
                            ) : (
                              <Button size="sm" variant="secondary" onClick={() => { setFreezeReasonUser(user); setFreezeReason(""); }}>
                                <ShieldOff className="h-3.5 w-3.5 mr-1" /> Suspend
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className={user.isTrusted ? "text-amber-600 border-amber-300" : "text-teal-600 border-teal-300"}
                              onClick={() => markTrusted(user, !user.isTrusted)}
                              disabled={actionLoading === `trust-${user.id}`}
                              title={user.isTrusted ? "Remove trusted status" : "Mark as trusted user"}
                            >
                              <Star className={`h-3.5 w-3.5 mr-1 ${user.isTrusted ? "fill-amber-400" : ""}`} />
                              {user.isTrusted ? "Untrust" : "Trust"}
                            </Button>
                            <Button size="sm" variant="outline" className="text-violet-600 border-violet-300" onClick={() => setBlockUser(user)}>
                              <BlocksIcon className="h-3.5 w-3.5 mr-1" /> Block Trade
                            </Button>
                            <Button size="sm" variant="outline" className="text-amber-700 border-amber-300" onClick={() => resetWarnings(user)} disabled={actionLoading === `warn-${user.id}`}>
                              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reset Warns
                            </Button>
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

      <Dialog open={!!freezeReasonUser} onOpenChange={(o) => !o && setFreezeReasonUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {freezeReasonUser?.username}?</DialogTitle>
            <DialogDescription>Optionally add a reason. This is shown internally in their user card and logged.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Freeze Reason (optional)</label>
              <Input value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)} placeholder="e.g. Fraudulent activity on order #123" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFreezeReasonUser(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleFreezeWithReason} disabled={freezeWithReasonLoading}>
              {freezeWithReasonLoading ? "Suspending..." : "Suspend User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!blockUser} onOpenChange={(o) => !o && setBlockUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Trade Pair — {blockUser?.username}</DialogTitle>
            <DialogDescription>
              Prevent this user from being matched with another specific user. Enter the target user's ID to block the pair from ever being matched together.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">User #{blockUser?.id} will be blocked from matching with:</label>
              <Input
                type="number"
                placeholder="Enter the other user's ID"
                value={blockTargetId}
                onChange={(e) => setBlockTargetId(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Input
                placeholder="e.g. Collusion suspected"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">This block prevents the matching engine from assigning these two users to each other's orders. You can view and remove all blocks from the Reports section.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBlockUser(null); setBlockTargetId(""); setBlockReason(""); }}>Cancel</Button>
            <Button onClick={handleAddBlock} disabled={blockLoading || !blockTargetId.trim()}>
              {blockLoading ? "Adding block..." : "Add Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
