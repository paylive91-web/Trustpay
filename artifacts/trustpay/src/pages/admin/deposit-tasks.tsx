import React, { useState } from "react";
import AdminLayout from "@/components/admin-layout";
import { useAdminGetDepositTasks, useAdminCreateDepositTask, useAdminUpdateDepositTask, useAdminDeleteDepositTask } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminGetDepositTasksQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2 } from "lucide-react";

export default function AdminDepositTasks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tasks, isLoading } = useAdminGetDepositTasks();
  
  const createMutation = useAdminCreateDepositTask();
  const updateMutation = useAdminUpdateDepositTask();
  const deleteMutation = useAdminDeleteDepositTask();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  
  const [amount, setAmount] = useState("");
  const [rewardPercent, setRewardPercent] = useState("");
  const [isActive, setIsActive] = useState(true);

  const openCreate = () => {
    setEditingTask(null);
    setAmount("");
    setRewardPercent("");
    setIsActive(true);
    setIsDialogOpen(true);
  };

  const openEdit = (task: any) => {
    setEditingTask(task);
    setAmount(task.amount.toString());
    setRewardPercent(task.rewardPercent.toString());
    setIsActive(task.isActive);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!amount || !rewardPercent) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }

    const payload = {
      amount: parseFloat(amount),
      rewardPercent: parseFloat(rewardPercent),
      isActive,
    };

    if (editingTask) {
      updateMutation.mutate({
        id: editingTask.id,
        data: payload
      }, {
        onSuccess: () => {
          toast({ title: "Task updated" });
          setIsDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: getAdminGetDepositTasksQueryKey() });
        }
      });
    } else {
      createMutation.mutate({
        data: payload
      }, {
        onSuccess: () => {
          toast({ title: "Task created" });
          setIsDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: getAdminGetDepositTasksQueryKey() });
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Delete this deposit task?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Task deleted" });
          queryClient.invalidateQueries({ queryKey: getAdminGetDepositTasksQueryKey() });
        }
      });
    }
  };

  const toggleActive = (task: any) => {
    updateMutation.mutate({
      id: task.id,
      data: { isActive: !task.isActive }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAdminGetDepositTasksQueryKey() });
      }
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Deposit Tasks</h1>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Task
          </Button>
        </div>
        
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount (₹)</TableHead>
                  <TableHead>Reward (%)</TableHead>
                  <TableHead>Reward (₹)</TableHead>
                  <TableHead>Total Return</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell>
                  </TableRow>
                ) : tasks && tasks.length > 0 ? (
                  tasks.map((task: any) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-bold text-lg">₹{task.amount}</TableCell>
                      <TableCell className="text-green-600 font-semibold">{task.rewardPercent}%</TableCell>
                      <TableCell>₹{task.rewardAmount.toFixed(2)}</TableCell>
                      <TableCell className="font-bold text-primary">₹{task.totalAmount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Switch 
                          checked={task.isActive} 
                          onCheckedChange={() => toggleActive(task)} 
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(task)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(task.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No tasks found. Create one above.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Deposit Task" : "Create Deposit Task"}</DialogTitle>
            <DialogDescription>Set the deposit amount and reward percentage for users.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Deposit Amount (₹)</Label>
              <Input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                placeholder="e.g. 500"
              />
            </div>
            <div className="space-y-2">
              <Label>Reward Percentage (%)</Label>
              <Input 
                type="number" 
                value={rewardPercent} 
                onChange={(e) => setRewardPercent(e.target.value)} 
                placeholder="e.g. 10"
              />
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Switch 
                id="active-switch" 
                checked={isActive} 
                onCheckedChange={setIsActive} 
              />
              <Label htmlFor="active-switch">Active (Visible to users)</Label>
            </div>
            
            {amount && rewardPercent && (
              <div className="bg-muted p-3 rounded-lg text-sm space-y-1 mt-4">
                <div className="flex justify-between text-muted-foreground">
                  <span>User deposits:</span>
                  <span>₹{parseFloat(amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>User earns:</span>
                  <span>+ ₹{(parseFloat(amount) * (parseFloat(rewardPercent) / 100)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1 mt-1">
                  <span>Total Return:</span>
                  <span>₹{(parseFloat(amount) * (1 + parseFloat(rewardPercent) / 100)).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingTask ? "Update Task" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
