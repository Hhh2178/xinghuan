import { useEffect, useState } from "react";

import { adminCostApi } from "./admin-api-client";
import type { ModelPricingRecord } from "./admin-types";

let pricingCache: ModelPricingRecord[] | null = null;
let pricingRequest: Promise<ModelPricingRecord[]> | null = null;

function loadPricing() {
  if (pricingCache) return Promise.resolve(pricingCache);
  pricingRequest ||= adminCostApi.readModelPricing().then((rows) => {
    pricingCache = rows;
    return rows;
  }).finally(() => { pricingRequest = null; });
  return pricingRequest;
}

export function AdminModelPricingSection({ modelId }: { modelId: string }) {
  const [enabled, setEnabled] = useState(true);
  const [billingUnit, setBillingUnit] = useState<"per_request" | "per_second">("per_request");
  const [unitPrice, setUnitPrice] = useState("0.000000");
  const [note, setNote] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState<number | null>(null);
  const [status, setStatus] = useState("正在读取当前价格...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    loadPricing().then((rows) => {
      if (!active) return;
      const current = rows.find((item) => item.modelId === modelId);
      if (current) {
        setEnabled(current.enabled);
        setBillingUnit(current.billingUnit);
        setUnitPrice(current.unitPrice);
        setNote(current.note);
        setEffectiveFrom(current.effectiveFrom);
        setStatus("当前价格版本已生效");
      } else {
        setStatus("未定价：新任务会单独标记，不会回算历史任务");
      }
    }).catch((error) => active && setStatus(error instanceof Error ? error.message : String(error)));
    return () => { active = false; };
  }, [modelId]);

  async function save() {
    setSaving(true);
    setStatus("");
    try {
      const saved = await adminCostApi.writeModelPricing(modelId, { enabled, billingUnit, unitPrice, currency: "CNY", note });
      pricingCache = [...(pricingCache || []).filter((item) => item.modelId !== modelId), saved];
      setUnitPrice(saved.unitPrice);
      setEffectiveFrom(saved.effectiveFrom);
      setStatus("新价格版本已生效；既有任务快照保持不变");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="model-pricing-card" aria-label="计费与费用统计">
      <header>
        <div>
          <strong>计费与费用统计</strong>
          <span>价格按任务创建时版本快照；默认人民币，暂不换算。</span>
        </div>
        <label className="model-pricing-toggle">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          <span>{enabled ? "参与计费" : "停止计费"}</span>
        </label>
      </header>
      <div className="model-pricing-grid">
        <label>计费方式
          <select value={billingUnit} onChange={(event) => setBillingUnit(event.target.value as "per_request" | "per_second")}>
            <option value="per_request">按次数</option>
            <option value="per_second">按秒数（整数秒）</option>
          </select>
        </label>
        <label>币种
          <input value="人民币（CNY）" readOnly />
        </label>
        <label>单价
          <input inputMode="decimal" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="0.000000" />
        </label>
        <label>计费说明
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="可选，记录上游价格口径" />
        </label>
      </div>
      <div className="model-pricing-foot">
        <small>{status}{effectiveFrom ? ` · 生效于 ${new Date(effectiveFrom).toLocaleString()}` : ""}</small>
        <button type="button" className="primary" disabled={saving} onClick={() => void save()}>{saving ? "保存中..." : "创建价格版本"}</button>
      </div>
      <p className="model-pricing-rule">成功任务计费；用户取消且上游未确认取消（包括未配置取消端口）仍计费。上游确认取消成功不计费。</p>
    </section>
  );
}
