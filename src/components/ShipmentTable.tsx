import { useState } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Search, 
  Filter, 
  Download, 
  Edit, 
  RefreshCw, 
  Calendar,
  Package,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Shipment {
  id: string;
  customer_name: string;
  address: string;
  tracking_id: string | null;
  delivery_date: string | null;
  package_weight: number | null;
  notes: string | null;
  status: string;
  original_file_name: string | null;
  parsed_by_ai: boolean;
  created_at: string;
  updated_at: string;
}

interface ShipmentTableProps {
  shipments: Shipment[];
  loading: boolean;
  onRefresh: () => void;
}

export const ShipmentTable = ({ shipments, loading, onRefresh }: ShipmentTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [editForm, setEditForm] = useState<Partial<Shipment>>({});
  const [saving, setSaving] = useState(false);

  const filteredShipments = shipments.filter(shipment => {
    const matchesSearch = 
      shipment.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (shipment.tracking_id && shipment.tracking_id.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || shipment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const exportToCSV = () => {
    const headers = [
      'Customer Name', 'Address', 'Tracking ID', 'Delivery Date', 
      'Package Weight', 'Status', 'Notes', 'Created At'
    ];
    
    const csvContent = [
      headers.join(','),
      ...filteredShipments.map(shipment => [
        `"${shipment.customer_name}"`,
        `"${shipment.address}"`,
        `"${shipment.tracking_id || ''}"`,
        `"${shipment.delivery_date || ''}"`,
        `"${shipment.package_weight || ''}"`,
        `"${shipment.status}"`,
        `"${shipment.notes || ''}"`,
        `"${format(new Date(shipment.created_at), 'yyyy-MM-dd HH:mm:ss')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shipments-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleEdit = (shipment: Shipment) => {
    setEditingShipment(shipment);
    setEditForm({
      customer_name: shipment.customer_name,
      address: shipment.address,
      tracking_id: shipment.tracking_id,
      delivery_date: shipment.delivery_date,
      package_weight: shipment.package_weight,
      notes: shipment.notes,
      status: shipment.status,
    });
  };

  const handleSave = async () => {
    if (!editingShipment) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('shipment_orders')
        .update(editForm)
        .eq('id', editingShipment.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Shipment updated successfully",
      });
      
      setEditingShipment(null);
      onRefresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update shipment",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'secondary',
      processing: 'default',
      shipped: 'default',
      delivered: 'default',
      cancelled: 'destructive',
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer, address, or tracking ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={exportToCSV} disabled={filteredShipments.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Tracking ID</TableHead>
              <TableHead>Delivery Date</TableHead>
              <TableHead>Weight (kg)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading shipments...
                </TableCell>
              </TableRow>
            ) : filteredShipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  No shipments found
                </TableCell>
              </TableRow>
            ) : (
              filteredShipments.map((shipment) => (
                <TableRow key={shipment.id}>
                  <TableCell className="font-medium">{shipment.customer_name}</TableCell>
                  <TableCell className="max-w-xs truncate">{shipment.address}</TableCell>
                  <TableCell>{shipment.tracking_id || '-'}</TableCell>
                  <TableCell>
                    {shipment.delivery_date ? (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(shipment.delivery_date), 'MMM dd, yyyy')}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{shipment.package_weight || '-'}</TableCell>
                  <TableCell>{getStatusBadge(shipment.status)}</TableCell>
                  <TableCell>
                    <Badge variant={shipment.parsed_by_ai ? 'default' : 'secondary'}>
                      {shipment.parsed_by_ai ? 'AI' : 'Manual'}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(shipment.created_at), 'MMM dd, HH:mm')}</TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(shipment)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Edit Shipment Order</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="customer_name">Customer Name</Label>
                            <Input
                              id="customer_name"
                              value={editForm.customer_name || ''}
                              onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="tracking_id">Tracking ID</Label>
                            <Input
                              id="tracking_id"
                              value={editForm.tracking_id || ''}
                              onChange={(e) => setEditForm({ ...editForm, tracking_id: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2 col-span-2">
                            <Label htmlFor="address">Address</Label>
                            <Textarea
                              id="address"
                              value={editForm.address || ''}
                              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="delivery_date">Delivery Date</Label>
                            <Input
                              id="delivery_date"
                              type="date"
                              value={editForm.delivery_date || ''}
                              onChange={(e) => setEditForm({ ...editForm, delivery_date: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="package_weight">Package Weight (kg)</Label>
                            <Input
                              id="package_weight"
                              type="number"
                              step="0.01"
                              value={editForm.package_weight || ''}
                              onChange={(e) => setEditForm({ ...editForm, package_weight: parseFloat(e.target.value) })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                              value={editForm.status || ''}
                              onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="shipped">Shipped</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 col-span-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                              id="notes"
                              value={editForm.notes || ''}
                              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setEditingShipment(null)}
                          >
                            Cancel
                          </Button>
                          <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredShipments.length} of {shipments.length} shipments
      </div>
    </div>
  );
};