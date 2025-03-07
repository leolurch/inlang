import { getContext } from "telefunc";

/**
 * Collaborator of a Github Repository,
 * Fetch function to get the Collaboraotr of a Github Repo.
 */
export async function isCollaborator(args: {
  owner: string;
  repository: string;
  username: string;
}) {
  const context = getContext();
  const response = await fetch(
    `https://api.github.com/repos/${args.owner}/${args.repository}/collaborators/${args.username}`,
    {
      headers: {
        Authorization: `Bearer ${context.githubAccessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  return response.ok;
}
