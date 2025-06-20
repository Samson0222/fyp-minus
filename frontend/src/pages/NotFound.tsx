
import React from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Card } from "@/components/ui/card";
import PrimaryButton from "@/components/ui/PrimaryButton";

const NotFound = () => {
  return (
    <Layout>
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full text-center py-8 px-6">
          <h2 className="text-3xl font-bold mb-2 text-gradient">404</h2>
          <h3 className="text-xl font-medium mb-4">Page Not Found</h3>
          <p className="text-foreground/70 mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link to="/">
            <PrimaryButton className="mx-auto">
              Return to Home
            </PrimaryButton>
          </Link>
        </Card>
      </div>
    </Layout>
  );
};

export default NotFound;
