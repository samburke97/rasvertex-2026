// types/global.d.ts
declare global {
  interface Window {
    marketplaceSetup?: {
      handleStepContinue?: () => void;
    };
  }
}

export {};
