import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler, Request } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const dbUrl = process.env.DATABASE_URL || "";
  const isProduction = process.env.NODE_ENV === "production";
  const needsSsl = isProduction || dbUrl.includes("render.com") || dbUrl.includes("neon.tech");
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    ...(needsSsl ? { conObject: { ssl: { rejectUnauthorized: false } } } : {}),
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function getCallbackURL(req: Request): string {
  const protocol = req.protocol;
  const host = req.get("host") || req.hostname;
  return `${protocol}://${host}/api/auth/google/callback`;
}

export async function setupGoogleAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientID || !clientSecret) {
    console.log("Google OAuth not configured - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required");
    app.get("/api/login", (req, res) => {
      res.status(503).json({ 
        message: "Google OAuth not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." 
      });
    });
    return;
  }

  const verify = async (accessToken: string, refreshToken: string, profile: Profile, done: Function) => {
    try {
      const email = profile.emails?.[0]?.value || null;
      const firstName = profile.name?.givenName || null;
      const lastName = profile.name?.familyName || null;
      const profileImageUrl = profile.photos?.[0]?.value || null;

      const user = await storage.upsertUser({
        id: profile.id,
        email,
        firstName,
        lastName,
        profileImageUrl,
      });

      done(null, user);
    } catch (error) {
      done(error as Error);
    }
  };

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || null);
    } catch (error) {
      done(error);
    }
  });

  app.get("/api/login", (req, res, next) => {
    const callbackURL = getCallbackURL(req);
    console.log(`[Auth] Login initiated, callback URL: ${callbackURL}`);
    
    passport.use(
      new GoogleStrategy(
        {
          clientID: clientID!,
          clientSecret: clientSecret!,
          callbackURL,
          scope: ["profile", "email"],
        },
        verify as any
      )
    );

    passport.authenticate("google", {
      scope: ["profile", "email"],
    })(req, res, next);
  });

  app.get(
    "/api/auth/google/callback",
    (req, res, next) => {
      const callbackURL = getCallbackURL(req);
      
      passport.use(
        new GoogleStrategy(
          {
            clientID: clientID!,
            clientSecret: clientSecret!,
            callbackURL,
            scope: ["profile", "email"],
          },
          verify as any
        )
      );

      passport.authenticate("google", {
        failureRedirect: "/?error=auth_failed",
      })(req, res, next);
    },
    (req, res) => {
      res.redirect("/builder");
    }
  );

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/");
    });
  });
}

export const isGoogleAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
