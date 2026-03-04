import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

type DeleteStatus = "loading" | "success" | "error";

export default function ConfirmDelete() {
  const [status, setStatus] = useState<DeleteStatus>("loading");
  const [message, setMessage] = useState("");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid or expired link. No token provided.");
      return;
    }

    const confirmDeletion = async () => {
      try {
        const res = await fetch(`/api/account/confirm-delete?token=${encodeURIComponent(token)}`, {
          credentials: "include",
        });
        const data = await res.json();

        if (res.ok) {
          setStatus("success");
          setMessage("Your account has been successfully deleted. All associated data has been removed.");
          queryClient.clear();
          setTimeout(() => {
            setLocation("/");
          }, 5000);
        } else {
          setStatus("error");
          setMessage(data.error || data.message || "Invalid or expired link. Please request a new deletion link.");
        }
      } catch {
        setStatus("error");
        setMessage("Something went wrong. Please try again later.");
      }
    };

    confirmDeletion();
  }, [token, setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center text-center p-8 gap-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" data-testid="icon-loading" />
              <h2 className="text-xl font-semibold" data-testid="text-status-title">Processing your request...</h2>
              <p className="text-muted-foreground" data-testid="text-status-message">Please wait while we confirm your account deletion.</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500" data-testid="icon-success" />
              <h2 className="text-xl font-semibold" data-testid="text-status-title">Account Deleted</h2>
              <p className="text-muted-foreground" data-testid="text-status-message">{message}</p>
              <p className="text-sm text-muted-foreground">You will be redirected to the home page in a few seconds.</p>
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                data-testid="button-go-home"
              >
                Go to Home
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive" data-testid="icon-error" />
              <h2 className="text-xl font-semibold" data-testid="text-status-title">Deletion Failed</h2>
              <p className="text-muted-foreground" data-testid="text-status-message">{message}</p>
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                data-testid="button-go-home"
              >
                Go to Home
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
