import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TrendingUp,
  User,
  Palette,
  HelpCircle,
  CreditCard,
  FileText,
  Trash2,
  LogOut,
  Moon,
  Sun,
  Mail,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from "lucide-react";

export default function AccountSettings() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    const initialTheme = stored || "dark";
    setTheme(initialTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  const handleDeleteRequest = async () => {
    setIsDeleting(true);
    try {
      await apiRequest("POST", "/api/account/delete-request");
      toast({
        title: "Confirmation email sent",
        description: "Check your email for a deletion confirmation link.",
      });
      setDeleteDialogOpen(false);
      setDeleteConfirmed(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send deletion email.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = () => {
    queryClient.clear();
    window.location.href = "/api/logout";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 flex h-16 items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2"
              data-testid="link-home"
            >
              <TrendingUp className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">OptionBuild</span>
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              onClick={() => setLocation("/builder")}
              data-testid="button-nav-builder"
            >
              Builder
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8 max-w-5xl">
        <h1 className="text-2xl font-bold mb-6" data-testid="text-page-title">Account Settings</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  <User className="h-4 w-4" />
                  User Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Email</span>
                  </div>
                  <span className="text-sm font-medium" data-testid="text-user-email">
                    {user?.email || "Not set"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  <Palette className="h-4 w-4" />
                  Appearance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {theme === "dark" ? (
                      <Moon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Sun className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">Dark Mode</span>
                  </div>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={toggleTheme}
                    data-testid="switch-dark-mode"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  <HelpCircle className="h-4 w-4" />
                  Help
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm font-medium">Contact Us</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please contact support@optionbuild.com for help
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium">FAQs</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation("/faq")}
                    data-testid="link-faq"
                  >
                    View FAQs
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  <CreditCard className="h-4 w-4" />
                  Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm">Current Plan</span>
                  <Badge variant="secondary" data-testid="badge-current-plan">Free</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  <FileText className="h-4 w-4" />
                  Billing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm">Payment Method</span>
                  <span className="text-sm text-muted-foreground" data-testid="text-payment-method">Coming Soon</span>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm">Invoices</span>
                  <span className="text-sm text-muted-foreground" data-testid="text-invoices">Coming Soon</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  <Trash2 className="h-4 w-4" />
                  Account
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="text-sm font-medium">Delete Account</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      Permanently delete your account and all data
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    data-testid="button-delete-account"
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </Button>
        </div>
      </main>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-delete-dialog-title">Delete Your Account</DialogTitle>
            <DialogDescription>
              This action is permanent. Your account and all associated data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md bg-destructive/10 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium">The following data will be deleted:</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
              <li>Your user account</li>
              <li>All saved trades</li>
              <li>Brokerage connections</li>
              <li>Chat history</li>
            </ul>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="confirm-delete"
              checked={deleteConfirmed}
              onCheckedChange={(checked) => setDeleteConfirmed(checked === true)}
              data-testid="checkbox-confirm-delete"
            />
            <label htmlFor="confirm-delete" className="text-sm cursor-pointer leading-5">
              I understand this action is permanent and cannot be undone
            </label>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <div className="flex gap-2 justify-end flex-wrap">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteConfirmed(false);
                }}
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!deleteConfirmed || isDeleting}
                onClick={handleDeleteRequest}
                data-testid="button-send-delete-email"
              >
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Send Deletion Confirmation Email
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              You will receive an email with a confirmation link. The link will expire in 24 hours.
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
