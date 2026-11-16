"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <div className="route-loading"><p className="eyebrow">A SMALL PAUSE</p><h1>Let’s try that again.</h1><p>This page couldn’t load. Your next step is still here.</p><button className="button button-dark" onClick={reset}>Try again</button></div>; }
