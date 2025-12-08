import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { MinimalLayout } from "@/components/layout/MinimalLayout";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
});

const Auth = () => {
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") as "creator" | "recipient" | null;
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLogin, setIsLogin] = useState(!role);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        if (profile?.role === "creator") {
          navigate("/creator");
        } else if (profile?.role === "recipient") {
          navigate("/recipient");
        }
      }
    };
    checkAuth();
  }, [navigate]);

  const validateForm = () => {
    try {
      const schema = isLogin 
        ? authSchema.pick({ email: true, password: true })
        : authSchema.extend({ name: z.string().min(2, "Name must be at least 2 characters") });
      
      schema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", data.user.id)
          .single();

        toast({
          title: "Welcome back!",
          description: "You've successfully logged in.",
        });

        if (profile?.role === "creator") {
          navigate("/creator");
        } else {
          navigate("/recipient");
        }
      } else {
        const userRole = role || "creator";
        
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        if (data.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              user_id: data.user.id,
              name: formData.name,
              email: formData.email,
              role: userRole,
            });

          if (profileError) throw profileError;

          if (userRole === "recipient") {
            await supabase
              .from("recipients")
              .update({ user_id: data.user.id })
              .eq("email", formData.email);
          }

          toast({
            title: "Account created!",
            description: "Welcome to Breadcrumbs.",
          });

          if (userRole === "creator") {
            navigate("/creator/profile");
          } else {
            navigate("/recipient");
          }
        }
      }
    } catch (error: any) {
      let message = error.message || "Something went wrong. Please try again.";
      
      if (message.includes("User already registered")) {
        message = "This email is already registered. Try logging in instead.";
      } else if (message.includes("Invalid login credentials")) {
        message = "Invalid email or password. Please try again.";
      }

      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MinimalLayout centered maxWidth="sm">
      {/* Back Link */}
      <Link 
        to={isLogin ? "/" : "/get-started"}
        className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-serif font-semibold text-white mb-2">
          {isLogin ? "Welcome Back" : role === "recipient" ? "Join as Recipient" : "Create Your Account"}
        </h1>
        <p className="text-white/60 text-sm">
          {isLogin 
            ? "Sign in to continue your journey." 
            : role === "recipient" 
              ? "Discover the wisdom left for you."
              : "Start leaving breadcrumbs for your loved ones."
          }
        </p>
      </div>

      <form 
        onSubmit={handleSubmit} 
        className="p-6 md:p-8 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10"
      >
        <div className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white/80">Full Name</Label>
              <Input
                id="name"
                placeholder="Your name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isLoading}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              {errors.name && (
                <p className="text-sm text-red-400">{errors.name}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/80">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={isLoading}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
            {errors.email && (
              <p className="text-sm text-red-400">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/80">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={isLoading}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
            {errors.password && (
              <p className="text-sm text-red-400">{errors.password}</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full mt-6 bg-amber-100 text-amber-950 hover:bg-amber-200"
            size="lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isLogin ? "Signing in..." : "Creating account..."}
              </>
            ) : (
              isLogin ? "Sign In" : "Create Account"
            )}
          </Button>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            {isLogin 
              ? "Don't have an account? Sign up" 
              : "Already have an account? Sign in"
            }
          </button>
        </div>
      </form>
    </MinimalLayout>
  );
};

export default Auth;
