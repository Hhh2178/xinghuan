import { prepareInlineImageReferences } from "@xinghuan/shared/node/grsai-reference-images";

export {
  prepareGrsaiReferenceImages,
  prepareInlineImageReferences,
  type PrepareGrsaiReferenceImagesInput,
  type PrepareInlineImageReferencesInput,
} from "@xinghuan/shared/node/grsai-reference-images";

interface PrepareProviderReferenceImagesInput {
  advancedConfig: Record<string, unknown>;
  dataDir: string;
  ownerId: string;
  values: string[];
}

export async function prepareProviderReferenceImages(input: PrepareProviderReferenceImagesInput) {
  if (input.advancedConfig.referenceImageTransport !== "data_url") return input.values;
  return prepareInlineImageReferences({
    dataDir: input.dataDir,
    ownerId: input.ownerId,
    values: input.values,
    limit: input.values.length,
    processing: input.advancedConfig.referenceImageProcessing,
  });
}
