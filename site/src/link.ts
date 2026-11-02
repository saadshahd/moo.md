/** A page's URL under the site's base path, e.g. "moves/freeze" → "/moo.md/moves/freeze/". */
export const href = (id: string) => `${import.meta.env.BASE_URL.replace(/\/$/, "")}/${id}/`;
