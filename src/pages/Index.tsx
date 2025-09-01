import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Users, Zap, BarChart3, ArrowRight } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6 mb-16">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Package className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Logistics Automation</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Streamline your shipment order processing with AI-powered data extraction, 
            real-time tracking, and intelligent monitoring.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/auth')}>
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/auth')}>
              Staff Login
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader className="text-center">
              <Zap className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle>AI-Powered Extraction</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Automatically extract shipment details from emails and PDF documents using advanced AI technology.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle>Smart Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Manage all shipment orders in one place with powerful search, filtering, and export capabilities.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle>Real-time Monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Track system performance, parsing success rates, and get alerts for critical issues.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle>Team Collaboration</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Secure staff authentication and role-based access to ensure data integrity and security.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <Card className="text-center p-8">
          <CardHeader>
            <CardTitle className="text-2xl">Ready to Automate Your Logistics?</CardTitle>
            <CardDescription className="text-lg">
              Join thousands of companies already using our platform to streamline their operations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" onClick={() => navigate('/auth')}>
              Start Your Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
