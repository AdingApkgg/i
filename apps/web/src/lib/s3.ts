import { createStorage, storageConfigFromEnv } from "@i/db/storage";

export { StorageError } from "@i/db/storage";

/** 相册对象存储（SeaweedFS S3 网关），配置见 S3_* 环境变量 */
export const storage = createStorage(storageConfigFromEnv());
