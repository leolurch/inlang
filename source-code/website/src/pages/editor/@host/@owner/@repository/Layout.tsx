import {
  fsChange,
  unpushedChanges,
  routeParams,
  StateProvider as EditorStateProvider,
  pushChanges,
  userIsCollaborator,
  repositoryInformation,
  currentBranch,
  inlangConfig,
  setFilteredLanguages,
  filteredLanguages,
} from "./state.js";
import {
  createEffect,
  createResource,
  createSignal,
  For,
  JSXElement,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import { raw } from "@inlang/git-sdk/api";
import { fs } from "@inlang/git-sdk/fs";
import { subSeconds, isAfter } from "date-fns";
import { currentPageContext } from "@src/renderer/state.js";
import { showToast } from "@src/components/Toast.jsx";
import { Layout as RootLayout } from "@src/pages/Layout.jsx";
import { useLocalStorage } from "@src/services/local-storage/LocalStorageProvider.jsx";
import type { EditorRouteParams } from "./types.js";
import { onFork } from "@src/services/github/index.js";
import { navigate } from "vite-plugin-ssr/client/router";
import type SlAlert from "@shoelace-style/shoelace/dist/components/alert/alert.js";
import { SignInDialog } from "@src/services/auth/components/SignInDialog.jsx";
import type SlDialog from "@shoelace-style/shoelace/dist/components/dialog/dialog.js";
import { clientSideEnv } from "@env";
import type { SemanticColorTokens } from "../../../../../../tailwind.config.cjs";
import { Icon } from "@src/components/Icon.jsx";
import MaterialSymbolsLoginRounded from "~icons/material-symbols/login-rounded";
import { tryCreateSession } from "@src/services/auth/lib/session/client.js";

const [hasPushedChanges, setHasPushedChanges] = createSignal(false);
// command-f this repo to find where the layout is called
export function Layout(props: { children: JSXElement }) {
  return (
    <RootLayout>
      <EditorStateProvider>
        <div class="py-4 w-full space-y-2 flex flex-col grow">
          <SignInBanner />
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <Breadcrumbs />
              <BranchMenu />
            </div>
            <sl-button-group prop:label="filterbar">
              <LanguageFilter />
              <HasChangesAction />
            </sl-button-group>{" "}
          </div>
          <hr class="h-px w-full bg-outline-variant my-2"> </hr>
          {props.children}
        </div>
      </EditorStateProvider>
    </RootLayout>
  );
}

function Breadcrumbs() {
  return (
    <div class="flex flex-row items-center space-x-2 text-lg font-medium">
      {/* repository icon */}
      <svg class="w-4 h-4" viewBox="0 0 16 16">
        <path
          fill="currentColor"
          fill-rule="evenodd"
          d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 1 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7a.75.75 0 0 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 0 1 1-1h8zM5 12.25v3.25a.25.25 0 0 0 .4.2l1.45-1.087a.25.25 0 0 1 .3 0L8.6 15.7a.25.25 0 0 0 .4-.2v-3.25a.25.25 0 0 0-.25-.25h-3.5a.25.25 0 0 0-.25.25z"
        />
      </svg>
      <h3>{routeParams().owner}</h3>
      <h3>/</h3>
      <h3>{routeParams().repository}</h3>
    </div>
  );
}

/**
 * The menu to select the branch.
 */
function BranchMenu() {
  const [branches] = createResource(fsChange, () => {
    return raw.listBranches({ fs: fs, dir: "/", remote: "origin" });
  });

  const [currentBranch] = createResource(fsChange, () => {
    return raw.currentBranch({ fs: fs, dir: "/" });
  });

  return (
    <Show when={(branches() ?? []).length > 0}>
      <sl-dropdown>
        <sl-button slot="trigger" prop:caret={true} prop:size="small">
          <div slot="prefix">
            {/* branch icon from github */}
            <svg class="w-4 h-4">
              <path
                fill="currentColor"
                fill-rule="evenodd"
                d="M11.75 2.5a.75.75 0 1 0 0 1.5a.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5a.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0a.75.75 0 0 1-1.5 0z"
              />
            </svg>
          </div>
          {currentBranch() ?? "undefined"}
        </sl-button>
        <sl-menu class="w-48 min-w-full">
          <div class="p-4">
            Not implemented yet. Discussion is ongoing in{" "}
            <a
              href="https://github.com/inlang/inlang/discussions/166"
              class="link link-primary"
              target="blank"
            >
              #166
            </a>
          </div>
          {/* <For each={branches()}>
						{(branch) => (
							<a
							href={`${currentPageContext().urlParsed.pathname}?branch=${branch}`}
							>
							<sl-menu-item prop:checked={currentBranch() === branch}>
							{branch}
							</sl-menu-item>
							</a>
							)}
						</For> */}
        </sl-menu>
      </sl-dropdown>
    </Show>
  );
}

/** Actions that can be conducted if a commit has been made but not pushed yet. */
function HasChangesAction() {
  const [latestChange, setLatestChange] = createSignal<Date>();
  const [showPulse, setShowPulse] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [localStorage] = useLocalStorage();

  createEffect(() => {
    if (unpushedChanges()) {
      setLatestChange(new Date());
    }
  });

  // show the pulse if less than X seconds ago a change has been conducted
  const interval = setInterval(() => {
    const _latestChange = latestChange();
    if (_latestChange === undefined) {
      return setShowPulse(false);
    }
    const eightSecondsAgo = subSeconds(new Date(), 8);
    return setShowPulse(isAfter(_latestChange, eightSecondsAgo));
  }, 1000);

  onCleanup(() => clearInterval(interval));

  async function triggerPushChanges() {
    if (localStorage.user === undefined) {
      return showToast({
        title: "Failed to push changes",
        message: "Please login first",
        variant: "warning",
      });
    }
    setIsLoading(true);
    const result = await pushChanges(
      currentPageContext.routeParams as EditorRouteParams,
      localStorage.user
    );
    setIsLoading(false);
    if (result.isErr) {
      return showToast({
        title: "Failed to push changes",
        message: "Please try again or file a bug. " + result.error,
        variant: "danger",
      });
    } else {
      setHasPushedChanges(true);
      return showToast({
        title: "Changes have been pushed",
        variant: "success",
      });
    }
  }

  return (
    <sl-button
      prop:disabled={(unpushedChanges() ?? []).length === 0}
      onClick={triggerPushChanges}
      prop:loading={isLoading()}
    >
      Push changes
      <Show when={(unpushedChanges() ?? []).length > 0}>
        <sl-badge prop:pill={true} prop:pulse={showPulse() ? true : false}>
          {(unpushedChanges() ?? []).length}
        </sl-badge>
      </Show>
    </sl-button>
  );
}

function LanguageFilter() {
  return (
    <Show when={inlangConfig()?.languages}>
      <sl-dropdown>
        <sl-button slot="trigger" prop:caret={true}>
          Languages
        </sl-button>
        <sl-menu class="p-4 rounded">
          <div class="flex gap-6">
            <a
              class="cursor-pointer text-sm font-medium link link-primary"
              onClick={() =>
                setFilteredLanguages(() => inlangConfig()!.languages)
              }
            >
              Select all
            </a>
            <a
              class="cursor-pointer text-sm font-normal link link-primary"
              onClick={() => setFilteredLanguages([])}
            >
              Deselect all
            </a>
          </div>
          <hr class="border-outline my-2" />
          <For each={inlangConfig()?.languages}>
            {(language) => (
              <Show when={language !== inlangConfig()?.referenceLanguage}>
                <sl-checkbox
                  class="block"
                  prop:checked={filteredLanguages().includes(language)}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  on:sl-change={(event: any) => {
                    if (event.target.__checked) {
                      setFilteredLanguages((value) => [...value, language]);
                    } else {
                      setFilteredLanguages((value) =>
                        value.filter((_language) => _language !== language)
                      );
                    }
                  }}
                >
                  {language}
                </sl-checkbox>
              </Show>
            )}
          </For>
        </sl-menu>
      </sl-dropdown>
    </Show>
  );
}

function SignInBanner() {
  const [localStorage] = useLocalStorage();
  const [isLoading, setIsLoading] = createSignal(false);

  let alert: SlAlert | undefined;

  createEffect(() => {
    // workaround for shoelace animation
    if (userIsCollaborator() === false) {
      setTimeout(() => {
        alert?.show();
      }, 50);
    } else {
      alert?.hide();
    }
  });

  let signInDialog: SlDialog | undefined;

  function onSignIn() {
    signInDialog?.show();
  }

  async function handleFork() {
    setIsLoading(true);
    if (localStorage.user === undefined) {
      return;
    }
    const response = await onFork({
      owner: (currentPageContext.routeParams as EditorRouteParams).owner,
      repository: (currentPageContext.routeParams as EditorRouteParams)
        .repository,
      username: localStorage.user.username,
    });
    if (response.type === "success") {
      showToast({
        variant: "success",
        title: "The Fork has been created.",
        message: `Don't forget to open a pull request`,
      });
      setIsLoading(false);
      return navigate(
        `/editor/github.com/${response.owner}/${response.repository}`
      );
    } else {
      showToast({
        variant: "danger",
        title: "The creation of the fork failed.",
        message: `Please try it again or report a bug`,
      });
      return response;
    }
  }
  return (
    <>
      <Switch>
        <Match when={localStorage.user === undefined}>
          <Banner
            variant="info"
            message={`You are currently not signed in. 
						Please sign in to make changes and work on this project.`}
          >
            <sl-button onClick={onSignIn} prop:variant="primary">
              <MaterialSymbolsLoginRounded slot="prefix" />
              Sign in
            </sl-button>
          </Banner>
        </Match>
        <Match
          when={
            userIsCollaborator.error === undefined &&
            userIsCollaborator.loading === false &&
            userIsCollaborator() === false &&
            localStorage.user
          }
        >
          <Banner
            variant="info"
            message={`
							You’re making changes in a project you don’t have write access
								to. Create a fork of this project to commit your proposed
								changes. Afterwards, you can send a pull request to the project.
								`}
          >
            <sl-button
              onClick={handleFork}
              prop:variant="primary"
              prop:loading={isLoading()}
            >
              <div slot="prefix">
                <svg width="1.2em" height="1.2em" viewBox="0 0 16 16">
                  <path
                    fill="currentColor"
                    d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0a.75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5a.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0a.75.75 0 0 0 1.5 0Z"
                  />
                </svg>
              </div>
              Fork this project
            </sl-button>
          </Banner>
        </Match>
        <Match
          when={
            repositoryInformation.error === undefined &&
            repositoryInformation.loading === false &&
            hasPushedChanges() &&
            repositoryInformation().fork
          }
        >
          <Banner
            variant="success"
            message={`You are working in a forked project. Please make a "pull request" to transfer your changes to the parent project:
							"${repositoryInformation().parent.full_name}"`}
          >
            <sl-button
              prop:target="_blank"
              prop:href={`https://github.com/${
                repositoryInformation().parent.full_name
              }/compare/${currentBranch}...${
                repositoryInformation().owner.login
              }:${
                repositoryInformation().name
              }:${currentBranch}?expand=1;title=Update%20translations;body=Describe%20the%20changes%20you%20have%20conducted%20here%0A%0APreview%20the%20messages%20on%20https%3A%2F%2Finlang.com%2Fgithub%2F${
                (currentPageContext.routeParams as EditorRouteParams).owner
              }%2F${
                (currentPageContext.routeParams as EditorRouteParams).repository
              }%20.`}
              prop:variant="success"
              // ugly workaround to close a the banner
              // after the button has been clicked
              onClick={() => setHasPushedChanges(false)}
            >
              <div slot="prefix">
                <svg width="1em" height="1em" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M16 19.25a3.25 3.25 0 1 1 6.5 0a3.25 3.25 0 0 1-6.5 0Zm-14.5 0a3.25 3.25 0 1 1 6.5 0a3.25 3.25 0 0 1-6.5 0Zm0-14.5a3.25 3.25 0 1 1 6.5 0a3.25 3.25 0 0 1-6.5 0ZM4.75 3a1.75 1.75 0 1 0 .001 3.501A1.75 1.75 0 0 0 4.75 3Zm0 14.5a1.75 1.75 0 1 0 .001 3.501A1.75 1.75 0 0 0 4.75 17.5Zm14.5 0a1.75 1.75 0 1 0 .001 3.501a1.75 1.75 0 0 0-.001-3.501Z"
                  />
                  <path
                    fill="currentColor"
                    d="M13.405 1.72a.75.75 0 0 1 0 1.06L12.185 4h4.065A3.75 3.75 0 0 1 20 7.75v8.75a.75.75 0 0 1-1.5 0V7.75a2.25 2.25 0 0 0-2.25-2.25h-4.064l1.22 1.22a.75.75 0 0 1-1.061 1.06l-2.5-2.5a.75.75 0 0 1 0-1.06l2.5-2.5a.75.75 0 0 1 1.06 0ZM4.75 7.25A.75.75 0 0 1 5.5 8v8A.75.75 0 0 1 4 16V8a.75.75 0 0 1 .75-.75Z"
                  />
                </svg>
              </div>
              Create pull request
            </sl-button>
          </Banner>
        </Match>
      </Switch>
      {/* <sl-button onClick={handlesncForking}>can i fork this thing</sl-button> */}
      <SignInDialog
        githubAppClientId={clientSideEnv.VITE_GITHUB_APP_CLIENT_ID}
        ref={signInDialog!}
        onClickOnSignInButton={() => {
          // hide the sign in dialog to increase UX when switching back to this window
          tryCreateSession();
          signInDialog?.hide();
        }}
      />
    </>
  );
}

function Banner(props: {
  variant: SemanticColorTokens[number];
  message: string;
  children: JSXElement;
}) {
  let alert: SlAlert | undefined;
  return (
    <sl-alert
      prop:variant={props.variant === "info" ? "primary" : props.variant}
      ref={alert}
      prop:open={true}
    >
      <Icon name={props.variant} slot="icon" />
      <div class="flex space-x-4 items-center">
        <p class="grow">{props.message}</p>
        {props.children}
      </div>
    </sl-alert>
  );
}
