// app/login/page.tsx — staff sign-in (see middleware.ts).
import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Sign in | RAS-VERTEX" };

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ras.png" alt="RAS-VERTEX" className={styles.logo} />
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.sub}>RAS-VERTEX staff only.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
