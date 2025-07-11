import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

interface UnauthorizedPageProps {
  serviceName: string;
  description?: string;
}

const UnauthorizedPage: React.FC<UnauthorizedPageProps> = ({ 
  serviceName,
  description = `To use the ${serviceName} module, you need to connect your Google account first.` 
}) => {
  return (
    <div className="flex items-center justify-center h-full p-4">
      <Card className="w-full max-w-lg bg-dark-secondary border-white/10 text-white">
        <CardHeader className="text-center">
          <div className="mx-auto bg-red-500/10 p-3 rounded-full w-fit">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <CardTitle className="text-2xl font-bold mt-4">
            Connection Required
          </CardTitle>
          <CardDescription className="text-white/70">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link to="/settings">
            <Button className="w-full sm:w-auto bg-violet hover:bg-violet-light">
              <Settings className="h-4 w-4 mr-2" />
              Go to Settings
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnauthorizedPage; 