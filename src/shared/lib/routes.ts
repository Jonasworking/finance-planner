/** Paths that more than one feature links to. Pot ids contain a colon, hence the encoding. */
export const potPath = (potId: string): string => `/pots/${encodeURIComponent(potId)}`
