// Addresses of stored photos (tool and inventory), usable on the client and the server.

/** The small copy of a stored photo, for lists (other addresses are returned as they are) */
export const thumbUrl = (url: string) => (/^\/api\/photos\/[a-z0-9]+$/i.test(url) ? `${url}?size=thumb` : url);
