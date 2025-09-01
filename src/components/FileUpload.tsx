import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, Mail, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface FileUploadProps {
  onUploadComplete: () => void;
}

export const FileUpload = ({ onUploadComplete }: FileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [emailContent, setEmailContent] = useState('');
  const [processingState, setProcessingState] = useState<'idle' | 'uploading' | 'extracting' | 'complete' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `${fileName}`;

    const { data, error } = await supabase.storage
      .from('shipment-files')
      .upload(filePath, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('shipment-files')
      .getPublicUrl(filePath);

    return { filePath: data.path, fileUrl: publicUrl, fileName: file.name };
  };

  const extractDataFromFile = async (fileContent: string, fileName: string, fileUrl?: string) => {
    const { data, error } = await supabase.functions.invoke('extract-shipment-data', {
      body: {
        fileContent,
        fileName,
        fileUrl: fileUrl || null,
      },
    });

    if (error) throw error;
    return data;
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setProcessingState('uploading');

    try {
      // Step 1: Upload file
      setProgress(25);
      const { fileUrl, fileName } = await uploadFile(file);

      // Step 2: Read file content (for PDF, we'll use a simple text extraction)
      setProgress(50);
      setProcessingState('extracting');
      
      const fileContent = await readFileContent(file);
      
      // Step 3: Extract data using AI
      setProgress(75);
      const result = await extractDataFromFile(fileContent, fileName, fileUrl);

      if (!result.success) {
        throw new Error(result.error || 'Failed to extract data');
      }

      setProgress(100);
      setProcessingState('complete');

      toast({
        title: "Success!",
        description: `Extracted shipment data for ${result.extractedData.customer_name}`,
      });

      onUploadComplete();

      // Reset state after 2 seconds
      setTimeout(() => {
        setProcessingState('idle');
        setProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      setProcessingState('error');
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : 'Failed to process file',
        variant: "destructive",
      });

      setTimeout(() => {
        setProcessingState('idle');
        setProgress(0);
      }, 3000);
    } finally {
      setUploading(false);
    }
  };

  const handleEmailExtraction = async () => {
    if (!emailContent.trim()) {
      toast({
        title: "Error",
        description: "Please enter email content",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setProgress(0);
    setProcessingState('extracting');

    try {
      setProgress(50);
      const fileName = `email-${Date.now()}.txt`;
      
      const result = await extractDataFromFile(emailContent, fileName);

      if (!result.success) {
        throw new Error(result.error || 'Failed to extract data');
      }

      setProgress(100);
      setProcessingState('complete');

      toast({
        title: "Success!",
        description: `Extracted shipment data for ${result.extractedData.customer_name}`,
      });

      onUploadComplete();
      setEmailContent('');

      // Reset state after 2 seconds
      setTimeout(() => {
        setProcessingState('idle');
        setProgress(0);
      }, 2000);

    } catch (error) {
      console.error('Email processing error:', error);
      setProcessingState('error');
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : 'Failed to process email content',
        variant: "destructive",
      });

      setTimeout(() => {
        setProcessingState('idle');
        setProgress(0);
      }, 3000);
    } finally {
      setUploading(false);
    }
  };

  const readFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        // For PDF files, we would need a proper PDF parser
        // For now, we'll just use the text content
        resolve(content || '');
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      if (file.type === 'application/pdf') {
        // For PDFs, we might need to extract text differently
        // For now, we'll read as text and let the AI handle it
        reader.readAsText(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const getProcessingMessage = () => {
    switch (processingState) {
      case 'uploading':
        return 'Uploading file...';
      case 'extracting':
        return 'AI is extracting shipment data...';
      case 'complete':
        return 'Successfully processed!';
      case 'error':
        return 'Processing failed';
      default:
        return '';
    }
  };

  const getProcessingIcon = () => {
    switch (processingState) {
      case 'uploading':
      case 'extracting':
        return <Loader2 className="h-5 w-5 animate-spin" />;
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="file" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="file" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Upload File
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Paste Email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="mt-6">
          <Card className="p-6">
            <div className="text-center space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Upload PDF Document</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Select a PDF file containing shipment order details
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  Choose File
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="emailContent">Email Content</Label>
                <Textarea
                  id="emailContent"
                  placeholder="Paste the email content containing shipment details here..."
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                  className="min-h-32 mt-2"
                  disabled={uploading}
                />
              </div>
              <Button
                onClick={handleEmailExtraction}
                disabled={uploading || !emailContent.trim()}
                className="w-full"
              >
                <Mail className="h-4 w-4 mr-2" />
                Extract Data from Email
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Progress Indicator */}
      {processingState !== 'idle' && (
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {getProcessingIcon()}
              <span className="text-sm font-medium">{getProcessingMessage()}</span>
            </div>
            {processingState !== 'complete' && processingState !== 'error' && (
              <Progress value={progress} className="w-full" />
            )}
          </div>
        </Card>
      )}

      <div className="text-sm text-muted-foreground space-y-1">
        <p><strong>Supported formats:</strong> PDF, TXT, DOC, DOCX</p>
        <p><strong>AI Extraction:</strong> The system will automatically extract customer name, address, tracking ID, delivery date, package weight, and notes from your documents.</p>
      </div>
    </div>
  );
};