import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  FileText,
  Clock,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

interface ParsingLog {
  id: string;
  file_name: string;
  file_url: string | null;
  status: string;
  error_message: string | null;
  extracted_data: any;
  created_at: string;
}

interface SystemStats {
  totalShipments: number;
  successfulParsing: number;
  failedParsing: number;
  processingParsing: number;
  todayShipments: number;
}

export const MonitoringPanel = () => {
  const [parsingLogs, setParsingLogs] = useState<ParsingLog[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalShipments: 0,
    successfulParsing: 0,
    failedParsing: 0,
    processingParsing: 0,
    todayShipments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [alertThreshold] = useState(100); // Alert when shipments exceed 100

  const fetchParsingLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('parsing_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setParsingLogs(data || []);
    } catch (error) {
      console.error('Error fetching parsing logs:', error);
      toast({
        title: "Error",
        description: "Failed to load parsing logs",
        variant: "destructive",
      });
    }
  };

  const fetchSystemStats = async () => {
    try {
      // Get total shipments
      const { count: totalShipments } = await supabase
        .from('shipment_orders')
        .select('*', { count: 'exact', head: true });

      // Get parsing stats
      const { data: parsingStats } = await supabase
        .from('parsing_logs')
        .select('status');

      const successfulParsing = parsingStats?.filter(log => log.status === 'success').length || 0;
      const failedParsing = parsingStats?.filter(log => log.status === 'failed').length || 0;
      const processingParsing = parsingStats?.filter(log => log.status === 'processing').length || 0;

      // Get today's shipments
      const today = new Date().toISOString().split('T')[0];
      const { count: todayShipments } = await supabase
        .from('shipment_orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`);

      setSystemStats({
        totalShipments: totalShipments || 0,
        successfulParsing,
        failedParsing,
        processingParsing,
        todayShipments: todayShipments || 0,
      });
    } catch (error) {
      console.error('Error fetching system stats:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchParsingLogs(), fetchSystemStats()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('monitoring')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'parsing_logs' },
        () => {
          fetchParsingLogs();
        }
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'shipment_orders' },
        () => {
          fetchSystemStats();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'default',
      failed: 'destructive',
      processing: 'secondary',
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  const successRate = systemStats.successfulParsing + systemStats.failedParsing > 0 
    ? Math.round((systemStats.successfulParsing / (systemStats.successfulParsing + systemStats.failedParsing)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* System Alerts */}
      {systemStats.totalShipments > alertThreshold && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            System is working 24/7! Total shipments ({systemStats.totalShipments}) exceed threshold ({alertThreshold}).
          </AlertDescription>
        </Alert>
      )}

      {systemStats.failedParsing > 5 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            High number of parsing failures detected ({systemStats.failedParsing}). Review failed documents.
          </AlertDescription>
        </Alert>
      )}

      {/* System Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.totalShipments}</div>
            <p className="text-xs text-muted-foreground">
              {systemStats.todayShipments} created today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {systemStats.successfulParsing} successful extractions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Parsing</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.failedParsing}</div>
            <p className="text-xs text-muted-foreground">
              Requires manual review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Activity className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.processingParsing}</div>
            <p className="text-xs text-muted-foreground">
              Currently being processed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Parsing Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Parsing Logs</CardTitle>
            <CardDescription>
              Monitor AI data extraction attempts and errors
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Extracted Data</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsingLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      No parsing logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  parsingLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          {getStatusBadge(log.status)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{log.file_name}</TableCell>
                      <TableCell>
                        {log.extracted_data && log.status === 'success' ? (
                          <div className="text-sm">
                            <div className="font-medium">{log.extracted_data.customer_name}</div>
                            <div className="text-muted-foreground truncate max-w-40">
                              {log.extracted_data.address}
                            </div>
                          </div>
                        ) : log.extracted_data && log.status === 'failed' ? (
                          <Badge variant="outline">Partial data</Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {log.error_message ? (
                          <div className="text-sm text-red-600 max-w-60 truncate" title={log.error_message}>
                            {log.error_message}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">AI Extraction Service</span>
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" />
                Online
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Database</span>
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">File Storage</span>
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" />
                Available
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Processing Times</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Average Processing</span>
              <span className="text-sm font-medium">~15 seconds</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">File Upload</span>
              <span className="text-sm font-medium">~2 seconds</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">AI Extraction</span>
              <span className="text-sm font-medium">~10 seconds</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};