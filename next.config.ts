import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-neon"],
  // next-mdx-remote (blog) évalue le MDX compilé au runtime — incompatible
  // avec Turbopack sans ce flag (voir node_modules/next-mdx-remote/README.md
  // et https://github.com/vercel/next.js/issues/64525). Sans lui, la page
  // article se rend uniquement côté client (aucun HTML server-rendu).
  transpilePackages: ["next-mdx-remote"],
};

export default nextConfig;
