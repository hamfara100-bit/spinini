import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

// Replace with your actual Google OAuth client IDs from Google Cloud Console
const CLIENT_IDS = {
  android: "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com",
  ios:     "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com",
  web:     "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
};

const DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

export const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint:         "https://oauth2.googleapis.com/token",
  revocationEndpoint:    "https://oauth2.googleapis.com/revoke",
};

export const GOOGLE_SCOPES = [
  "openid",
  "profile",
  "email",
  "https://www.googleapis.com/auth/drive.file",      // Visible Drive folders created by app
  "https://www.googleapis.com/auth/photoslibrary",   // Google Photos upload
];

export const KID_SCOPES = [
  "openid",
  "profile",
  "email",
  "https://www.googleapis.com/auth/drive.file",      // Kid's own Drive folder
  "https://www.googleapis.com/auth/photoslibrary.appendonly",
];

export function getClientId(): string {
  if (Platform.OS === "android") return CLIENT_IDS.android;
  if (Platform.OS === "ios") return CLIENT_IDS.ios;
  return CLIENT_IDS.web;
}

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUser> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google user info");
  const data = await res.json();
  return {
    id: data.sub,
    email: data.email,
    name: data.name,
    picture: data.picture,
    accessToken,
  };
}
