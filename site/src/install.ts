import script from "../public/install.sh?raw";

/** Every install command the site shows, built from the policy values at the
 * top of public/install.sh, so a page never names a plugin source, an output
 * style or a flag the script does not use. A value the script drops fails the
 * build. tools/check-install.sh reads INSTALL_LINE from this file. */
const value = (name: string) => {
  const found = script.match(new RegExp(`^${name}="(.*)"$`, "m"))?.[1];
  if (found === undefined) throw new Error(`public/install.sh sets no ${name}`);
  return found;
};
const MARKETPLACE_SOURCE = value("MARKETPLACE_SOURCE");
const MARKETPLACE_NAME = value("MARKETPLACE_NAME");
const OUTPUT_STYLE = value("OUTPUT_STYLE");
const SKILLS_CLI = value("SKILLS_CLI");
const SKILLS_AGENT = value("SKILLS_AGENT");

export const INSTALL_LINE =
  "curl -fsSL https://saadshahd.github.io/moo.md/install.sh | sh";
export const INSTALL_SCRIPT_URL = INSTALL_LINE.split(" ").find((word) =>
  word.startsWith("https://"),
)!;
export const FIRST_COMMAND = "/hope:full <your seed>";
export const RELOAD_PLUGINS = "/reload-plugins";

/** The plugins the one line installs. */
export const PLUGINS = value("PLUGINS").split(" ");

export const pluginInstall = (plugin: string) =>
  `claude plugin install ${plugin} --marketplace ${MARKETPLACE_SOURCE} --scope user`;
export const MARKETPLACE_UPDATE = `claude plugin marketplace update ${MARKETPLACE_NAME}`;
export const pluginUpdate = (plugin: string) =>
  `claude plugin update ${plugin}@${MARKETPLACE_NAME}`;

export const OUTPUT_STYLE_SETTING = `"outputStyle": "${OUTPUT_STYLE}"`;
export const OUTPUT_STYLE_COMMAND = `/output-style ${OUTPUT_STYLE}`;

/** One plugin's skills as files in the shared .agents folder, which Claude
 * Code does not read. */
export const skillFiles = (plugin: string) =>
  `npx --yes ${SKILLS_CLI} add ${MARKETPLACE_SOURCE}/${plugin} --global --agent ${SKILLS_AGENT} --skill '*' --yes`;
/** The picker: the reader chooses the skills and the agent. */
export const SKILL_PICKER = `npx ${SKILLS_CLI} add ${MARKETPLACE_SOURCE}`;
