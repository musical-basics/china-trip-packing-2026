/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the libSQL client (and its optional native binding for local file
  // mode) out of the bundler; it's loaded from node_modules at runtime.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
