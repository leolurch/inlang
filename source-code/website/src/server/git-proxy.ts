/**
 * ------------------------------------
 * The git proxy routes and authenticates requests
 * to git hosts like GitHub and GitLab.
 *
 * The proxy exists to avoid CORS issues and authenticate
 * requests.
 * ------------------------------------
 */

// import { assert } from "@src/services/assert/index.js";
import { Router } from "express";
import { serverSideEnv } from "@env";
// @ts-ignore
import createMiddleware from "@isomorphic-git/cors-proxy/middleware.js";
import { decryptAccessToken } from "@src/services/auth/logic.js";
import { verifyInlangSession } from "@src/services/auth/lib/session/server.js";
import type { InlangSessionRequest } from "@src/services/auth/lib/session/types.server.js";

const middleware = createMiddleware({});
const env = await serverSideEnv();

export const gitProxyRouter = Router();

// forward git requests to the proxy with wildcard `*`.
gitProxyRouter.all(
  env.VITE_GIT_REQUEST_PROXY_PATH + "*",
  verifyInlangSession({ sessionRequired: false }),
  async (request: InlangSessionRequest, response, next) => {
    // TODO enable after https://github.com/brillout/vite-plugin-ssr/discussions/560#discussioncomment-4420315
    // TODO currently not using vite to bundle this file, hence the call below will not be pruned
    // assert(request.url.startsWith(env.VITE_GIT_REQUEST_PROXY_PATH));

    if (request.path.includes("github") === false) {
      response.status(500).send("Unsupported git hosting provider.");
    }
    try {
      // decrypt the access token if it exists

      let sessionData;
      if (request.session != undefined) {
        sessionData = await request.session.getSessionData();
      }

      const encryptedAccessToken = sessionData?.encryptedAccessToken;
      if (encryptedAccessToken) {
        const decryptedAccessToken = await decryptAccessToken({
          JWE_SECRET_KEY: env.JWE_SECRET_KEY,
          jwe: encryptedAccessToken,
        });
        // set the authorization header (must be base64 encoded)
        request.headers["authorization"] = `Basic ${btoa(
          decryptedAccessToken
        )}`;
      }
      // remove the proxy path from the url
      request.url = request.url.slice(env.VITE_GIT_REQUEST_PROXY_PATH.length);
      middleware(request, response, next);
    } catch (error) {
      next(error);
    }
  }
);
