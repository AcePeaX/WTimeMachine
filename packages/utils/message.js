export const BLOCK_per_VAULT = 8;
export const GROUP_per_BLOCK = 8;
export const CHUNK_per_GROUP = 8;
export const MESSAGE_per_CHUNK = 8;

export const TOTAL_per_VAULT =
    BLOCK_per_VAULT * GROUP_per_BLOCK * CHUNK_per_GROUP * MESSAGE_per_CHUNK;
export const TOTAL_per_BLOCK =
    GROUP_per_BLOCK * CHUNK_per_GROUP * MESSAGE_per_CHUNK;
export const TOTAL_per_GROUP = CHUNK_per_GROUP * MESSAGE_per_CHUNK;
export const TOTAL_per_CHUNK = MESSAGE_per_CHUNK;

/**
 * Converts a flat message index to a hierarchy of {vault, block, group, chunk, message}
 */
export function indexToHierarchy(index) {
    const vault = Math.floor(index / TOTAL_per_VAULT);
    const indexInVault = index % TOTAL_per_VAULT;

    const block = Math.floor(indexInVault / TOTAL_per_BLOCK);
    const indexInBlock = indexInVault % TOTAL_per_BLOCK;

    const group = Math.floor(indexInBlock / TOTAL_per_GROUP);
    const indexInGroup = indexInBlock % TOTAL_per_GROUP;

    const chunk = Math.floor(indexInGroup / TOTAL_per_CHUNK);
    const message = indexInGroup % TOTAL_per_CHUNK;

    return { vault, block, group, chunk, message };
}

/**
 * Converts a hierarchy {vault, block, group, chunk, message} back to a flat index
 */
export function hierarchyToIndex({ vault, block, group, chunk, message }) {
    return (
        vault * TOTAL_per_VAULT +
        block * TOTAL_per_BLOCK +
        group * TOTAL_per_GROUP +
        chunk * TOTAL_per_CHUNK +
        message
    );
}