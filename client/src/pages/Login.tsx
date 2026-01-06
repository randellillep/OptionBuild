import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SiGoogle, SiApple } from "react-icons/si";
import { TrendingUp, Eye, EyeOff, X } from "lucide-react";
import { useLocation, Link } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleGoogleLogin = () => {
    // Redirect to Replit Auth (Google OAuth)
    window.location.href = "/api/login";
  };

  const handleClose = () => {
    setLocation("/builder");
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Dark branding section */}
      <div className="hidden lg:flex lg:w-1/2 bg-black flex-col justify-center px-12 xl:px-20 relative">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <TrendingUp className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold text-white italic">OptionBuild</span>
        </div>
        
        {/* Welcome Text */}
        <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
          Welcome to one of<br />
          the largest options<br />
          analysis communities<br />
          on the planet.
        </h1>
        
        {/* Features list */}
        <div className="mt-12 space-y-4 text-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary"></div>
            <span>Real-time options pricing and analytics</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Interactive P/L visualization</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
            <span>Save and track your strategies</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login form */}
      <div className="w-full lg:w-1/2 bg-white dark:bg-background flex flex-col justify-center px-8 sm:px-12 xl:px-20 relative">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4"
          onClick={handleClose}
          data-testid="button-close-login"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Mobile Logo */}
        <div className="flex items-center gap-2 mb-8 lg:hidden">
          <TrendingUp className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold italic">OptionBuild</span>
        </div>

        {/* Desktop Logo */}
        <div className="hidden lg:flex items-center gap-2 mb-8 justify-center">
          <TrendingUp className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold italic">OptionBuild</span>
        </div>

        <div className="max-w-sm mx-auto w-full">
          <h2 className="text-xl font-semibold mb-6 text-center">
            {isSignUp ? "Get Started" : "Log In"}
          </h2>

          {/* Email input */}
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="Email or Username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
              data-testid="input-email"
            />

            {/* Password input (only for traditional login) */}
            {!isSignUp && (
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}

            {/* Submit Button */}
            <Button
              className="w-full h-11 bg-primary/80 hover:bg-primary"
              disabled={!email}
              data-testid="button-submit-login"
            >
              {isSignUp ? "Sign Up" : "Log In"}
            </Button>

            {/* Forgot password / Sign up toggle */}
            <div className="flex justify-between text-sm">
              {!isSignUp && (
                <button className="text-primary hover:underline">
                  Forgot your password?
                </button>
              )}
              <button
                className="text-primary hover:underline ml-auto"
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? "Log in" : "Sign up"}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          {/* Social login buttons */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-11 gap-3 font-normal"
              onClick={handleGoogleLogin}
              data-testid="button-google-login"
            >
              <SiGoogle className="h-4 w-4" />
              Continue with Google
            </Button>

            <Button
              variant="outline"
              className="w-full h-11 gap-3 font-normal"
              disabled
              data-testid="button-apple-login"
            >
              <SiApple className="h-4 w-4" />
              Continue with Apple
            </Button>
          </div>

          {/* Terms */}
          <p className="text-xs text-muted-foreground mt-6 text-center">
            By signing up, you agree to the{" "}
            <button className="text-primary hover:underline">Terms and Conditions</button>.
          </p>

          {/* Additional info */}
          <div className="mt-8 text-xs text-muted-foreground text-center space-y-2">
            <p>
              OptionBuild is not a securities broker-dealer, investment adviser, or any other type of financial professional.
              No content on the OptionBuild platform should be considered an offer, solicitation or advice to buy or sell securities
              or any other type of investment or financial product.
            </p>
            <p>
              By using the OptionBuild platform, you understand and agree that OptionBuild does not provide investment advice,
              recommend any security, transaction, or order, issue securities, produce or provide research.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
