import { invalidateAdminQueries } from "./admin-query-client";
import { adminMutationDomains, adminQueryKeys } from "./admin-query-keys";

export function invalidateAdminMutation(pathname: string) {
  for (const domain of adminMutationDomains(pathname)) invalidateAdminQueries(adminQueryKeys[domain]);
}
