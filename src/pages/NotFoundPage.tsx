import { Link } from "wouter";
import { Bunny } from "../components/Bunny";
import { Button } from "../design-system/ui";

export function NotFoundPage() {
  return (
    <main
      className="app-screen"
      style={{
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        paddingTop: 56,
      }}
      data-testid="page-not-found"
    >
      <Bunny variant="cry" size={200} frame="circle" glow alt="우는 토끼" />
      <h1 className="t-h1" style={{ margin: 0 }}>여기 당근 없는데...</h1>
      <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 0 }}>
        길 잃었어? 흐흐 내가 찾아낼 줄 알았다.
      </p>
      <Link href="/">
        <Button variant="primary" size="lg" data-testid="button-not-found-home">
          집으로 가자
        </Button>
      </Link>
    </main>
  );
}
