declare module 'fs' {
  const fs: any;
  export default fs;
}

declare module 'path' {
  const path: any;
  export default path;
}

declare module 'crypto' {
  const crypto: any;
  export default crypto;
}

declare module '@google/genai' {
  export const GoogleGenAI: any;
}
