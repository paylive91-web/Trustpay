import React, { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminGetUsers, useAdminUpdateUserBalance } from "@workspace/api-client-react";
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

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useAdminGetUsers();
  const updateBalanceMutation = useAdminUpdateUserBalance();

  const [editUser, setEditUser] = useState<any>(null);
  const [newBalance, setNewBalance] = useState("");
  const [reason, setReason] = useState("");

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
        toast({ title: "Error", description: err.error || "Failed to update", variant: "destructive" });
      }
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Manage Users</h1>
        
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Stats</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell>
                    </TableRow>
                  ) : users && users.length > 0 ? (
                    users.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.id}</TableCell>
                        <TableCell>
                          <div className="font-medium">{user.username}</div>
                          {user.phone && <div className="text-xs text-muted-foreground">{user.phone}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? "default" : "secondary"}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-primary">₹{user.balance.toFixed(2)}</TableCell>
                        <TableCell className="text-xs space-y-1">
                          <div>Dep: ₹{user.totalDeposits.toFixed(2)}</div>
                          <div>With: ₹{user.totalWithdrawals.toFixed(2)}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {user.createdAt ? format(new Date(user.createdAt), "MMM dd, yyyy") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => openEdit(user)}>
                            Edit Balance
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No users found.</TableCell>
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
    </AdminLayout>
  );
}
