import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { clientOrdersMe } from "../utils/clientStorage";

function money(n) {
  const value = Number(n || 0);
  return value.toFixed(2);
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function getOrderId(o) {
  return o?.id || o?._id || o?.order_id || o?.orderId || "";
}

function getOrderTotal(o) {
  return (
    o?.totals?.total ||
    o?.total ||
    o?.amount ||
    o?.data?.total ||
    0
  );
}

function getOrderStatus(o) {
  return o?.status || o?.state || o?.order_status || "placed";
}

function getOrderItems(o) {
  const items =
    o?.items ||
    o?.orderItems ||
    o?.order_items ||
    o?.data?.items ||
    [];
  return Array.isArray(items) ? items : [];
}

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const count = useMemo(() => orders.length, [orders]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await clientOrdersMe();
      if (!res.ok) {
        setError(res.message || "Failed to load orders.");
        setOrders([]);
        return;
      }
      setOrders(Array.isArray(res.orders) ? res.orders : []);
    } catch (e) {
      setError(e?.message || "Failed to load orders.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 980, margin: "40px auto", padding: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <h2 style={{ marginBottom: 6 }}>My Orders</h2>
          <p style={{ marginTop: 0, opacity: 0.8 }}>
            API: <b>/api/orders/me</b> • Total orders: <b>{count}</b>
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link to="/" style={{ textDecoration: "none" }}>
            ← Back to site
          </Link>
          <button type="button" className="sb-btn" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <div
          style={{
            background: "#ffe5e5",
            border: "1px solid #ffb3b3",
            color: "#8a1f1f",
            padding: 10,
            borderRadius: 8,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ opacity: 0.85 }}>Loading orders...</div>
      ) : orders.length === 0 ? (
        <div style={{ opacity: 0.85 }}>
          No orders yet.{" "}
          <Link to="/products" style={{ textDecoration: "none" }}>
            Shop now →
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {orders.map((o) => {
            const id = getOrderId(o);
            const items = getOrderItems(o);
            const createdAt = o?.createdAt || o?.created_at || o?.date || o?.created;
            const payment =
              o?.paymentMethod || o?.payment_method || o?.payment || "cash_on_delivery";

            return (
              <div
                key={id || JSON.stringify(o)}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 12,
                  padding: 16,
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "baseline",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      Order{" "}
                      <span style={{ fontFamily: "monospace" }}>
                        {id || "(no id)"}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                      {formatDate(createdAt)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                      Status: <b>{getOrderStatus(o)}</b>
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                      Payment: <b>{String(payment).replaceAll("_", " ")}</b>
                    </div>
                    <div style={{ fontSize: 16 }}>
                      Total: <b>${money(getOrderTotal(o))}</b>
                    </div>
                  </div>
                </div>

                <hr style={{ margin: "12px 0" }} />

                <div style={{ display: "grid", gap: 10 }}>
                  {items.length === 0 ? (
                    <div style={{ opacity: 0.8 }}>No items data.</div>
                  ) : (
                    items.map((it, idx) => {
                      const name = it?.name || it?.productName || it?.title || "Item";
                      const qty = Number(it?.quantity || it?.qty || 1);
                      const price = Number(it?.price || 0);
                      const image = it?.image || it?.img || it?.photo;

                      return (
                        <div
                          key={it?.id || it?._id || `${id}-item-${idx}`}
                          style={{
                            display: "grid",
                            gridTemplateColumns: image ? "56px 1fr auto" : "1fr auto",
                            gap: 10,
                            alignItems: "center",
                            border: "1px solid #eee",
                            borderRadius: 10,
                            padding: 10,
                          }}
                        >
                          {image ? (
                            <img
                              src={image}
                              alt={name}
                              style={{
                                width: 56,
                                height: 56,
                                objectFit: "cover",
                                borderRadius: 10,
                                border: "1px solid #eee",
                              }}
                            />
                          ) : null}
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {name}
                            </div>
                            <div style={{ fontSize: 13, opacity: 0.8 }}>
                              Qty: <b>{qty}</b>
                            </div>
                          </div>
                          <div style={{ fontWeight: 800 }}>
                            ${money(price * Math.max(1, qty))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


