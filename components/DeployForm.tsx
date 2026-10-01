"use client";

import { useEffect, useState } from "react";
import { OPERATOR, ROUTER_ADDRESS, explorerAddress } from "@/lib/config";
import { ensureRouter } from "@/lib/tab";
import { errorText, publicClient, useWallet, wallet } from "@/lib/wallet";

/** The router's address is already fixed. This page says whether it is on chain yet, and lets anyone put it there. */
export function DeployForm() {
  const w = useWallet();
  const [deployed, setDeployed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ROUTER_ADDRESS) return;
    let live = true;
    publicClient
      .getCode({ address: ROUTER_ADDRESS })
      .then((code) => live && setDeployed(Boolean(code)))
      .catch(() => live && setDeployed(false));
    return () => {
      live = false;
    };
  }, []);

  if (!ROUTER_ADDRESS) {
    return <p className="panel p-7 max-w-[680px] text-mute">This site has no operator address configured, so there is no contract to deploy.</p>;
  }

  async function deploy() {
    setBusy(true);
    setError(null);
    try {
      await ensureRouter();
      setDeployed(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-7 md:p-9 max-w-[680px] grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[22px]">Covered router</h2>
        <span className={`tag ${deployed ? "bg-sage-soft" : "bg-accent-soft"}`}>{deployed === null ? "Checking…" : deployed ? "On chain" : "Not on chain yet"}</span>
      </div>
      <dl className="grid gap-3 text-[14.5px]">
        <div className="tile p-4">
          <dt className="text-mute text-[13px]">Address</dt>
          <dd className="num break-all select-all mt-1">
            <a className="hover:underline" href={explorerAddress(ROUTER_ADDRESS)} target="_blank" rel="noreferrer">
              {ROUTER_ADDRESS}
            </a>
          </dd>
        </div>
        {OPERATOR && (
          <div className="tile p-4">
            <dt className="text-mute text-[13px]">Operator (owner, fulfiller and treasury to begin with)</dt>
            <dd className="num break-all select-all mt-1">{OPERATOR}</dd>
          </div>
        )}
      </dl>
      {error && (
        <p role="alert" className="text-red font-semibold text-[14.5px]">
          {error}
        </p>
      )}
      {deployed === false &&
        (w.address ? (
          <button className="btn btn-primary" disabled={busy} onClick={deploy}>
            {busy ? "Deploying…" : "Deploy the router"}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={wallet.open}>
            Connect wallet to deploy
          </button>
        ))}
      <p className="hint">
        One transaction, from any wallet, once. The first person to launch a coin is asked to send it if nobody has; the address above does not
        depend on who does.
      </p>
    </div>
  );
}
