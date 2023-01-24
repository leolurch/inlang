import type { ServerSideEnv } from "@env";
import { CompactEncrypt, compactDecrypt, base64url } from "jose";

// enc = encoding
const enc = "A128CBC-HS256";
// dir = direct encryption
const alg = "dir";
// the scopes for the oauth app https://docs.github.com/en/developers/apps/building-oauth-apps/scopes-for-oauth-apps
// email is required to commit with identity of who committed
const scopes = "repo,user:email";

/**
 * Encrypts a string using JWE.
 *
 * The string being the interim code returned from
 * https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github
 *
 * @throws
 */
export async function encryptAccessToken(args: {
  accessToken: string;
  JWE_SECRET_KEY: ServerSideEnv["JWE_SECRET_KEY"];
}): Promise<string> {
  try {
    const secret = base64url.decode(args.JWE_SECRET_KEY);
    const jwe = await new CompactEncrypt(
      new TextEncoder().encode(args.accessToken)
    )
      .setProtectedHeader({ alg, enc })
      .encrypt(secret);
    return jwe;
  } catch (error) {
    throw Error("Failed to encrypt access token", { cause: error });
  }
}

/**
 * Decrypts a JWE obtained by `exchangeInterimCodeForJwe`.
 *
 * @important only call this function on the server-side.
 * @throws if the decryption fails
 */
export async function decryptAccessToken(args: {
  jwe: string;
  JWE_SECRET_KEY: ServerSideEnv["JWE_SECRET_KEY"];
}): Promise<string> {
  const { plaintext } = await compactDecrypt(
    args.jwe,
    base64url.decode(args.JWE_SECRET_KEY)
  );
  return new TextDecoder().decode(plaintext);
}

/**
 * The URL to redirect the user to in order to authenticate.
 *
 * Read https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#1-request-a-users-github-identity
 */
export function githubAuthUrl(githubAppClientId: string) {
  return `https://github.com/login/oauth/authorize?client_id=${githubAppClientId}&scope=${scopes}`;
}

/**
 * Exchange the interim code for an access token.
 *
 * Read https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github
 */
export async function exchangeInterimCodeForAccessToken(args: {
  code: string;
  env: ServerSideEnv;
}): Promise<string> {
  // fetch post request to github
  const request = await fetch(
    `https://github.com/login/oauth/access_token?client_id=${args.env.VITE_GITHUB_APP_CLIENT_ID}&client_secret=${args.env.GITHUB_APP_CLIENT_SECRET}&code=${args.code}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    }
  );
  if (request.ok === false) {
    throw Error("exchanging the interim token failed", {
      cause: request.statusText,
    });
  }
  const requestBody = await request.json();
  if (requestBody.error) {
    throw Error("Exchanging the interim token failed", {
      cause: requestBody.error_description,
    });
  }
  return requestBody.access_token;
}

// /**
//  * Get the user info from the GitHub API.
//  *
//  * Read https://docs.github.com/en/rest/users/users?apiVersion=2022-11-28#get-the-authenticated-user
//  * @throws
//  */
// export async function getGithubUserInfo(args: {
// 	githubAccessToken: string;
// }): Promise<LocalStorageSchema["user"] | undefined> {
// 	if (args.githubAccessToken === undefined) {
// 		return undefined;
// 	}

// 	const request = await fetch("https://api.github.com/user", {
// 		headers: {
// 			Accept: "application/vnd.github+json",
// 			Authorization: `Bearer ${args.githubAccessToken}`,
// 			"X-GitHub-Api-Version": "2022-11-28",
// 		},
// 	});

// 	if (request.ok === false) {
// 		throw Error("Failed to get user info " + request.statusText);
// 	}

// 	const requestBody = await request.json();
// 	return {
// 		username: requestBody.login,
// 		avatarUrl: requestBody.avatar_url,
// 	};
// }

// const getSessionData = async (args: {}) => {
// 	if (true) {
// 	}
// };
