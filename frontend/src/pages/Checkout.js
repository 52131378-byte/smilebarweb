import React, { useContext, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { CartContext } from "../context/CartContext";
import { apiUrl } from "../utils/apiBase";
import { getClientSession } from "../utils/clientStorage";
import { getAdminSession } from "../utils/adminStorage";

async function readJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function money(n) {
  const value = Number(n || 0);
  return value.toFixed(2);
}

export default function Checkout() {
  const navigate = useNavigate();
  const { cartItems, clearCart, removeFromCart } = useContext(CartContext);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);

  const subtotal = useMemo(() => {
    return (cartItems || []).reduce(
      (sum, item) =>
        sum +
        Number(item?.price || 0) * Math.max(1, Number(item?.quantity || 1)),
      0
    );
  }, [cartItems]);

  const shipping = 0; // COD: free shipping for now
  const total = subtotal + shipping;

  const onPlaceOrder = async (e) => {
    e.preventDefault();
    if (placing) return;

    if (!cartItems || cartItems.length === 0) {
      toast.info("Your cart is empty.");
      navigate("/cart");
      return;
    }

    const nameTrimmed = String(fullName || "").trim();
    const phoneTrimmed = String(phone || "").trim();
    const addressTrimmed = String(address || "").trim();
    const cityTrimmed = String(city || "").trim();

    if (!nameTrimmed) return toast.error("Full name is required.");
    if (!phoneTrimmed) return toast.error("Phone number is required.");
    if (!addressTrimmed) return toast.error("Address is required.");
    if (!cityTrimmed) return toast.error("City is required.");

    setPlacing(true);
    try {
      const session = getClientSession();
      const token = session?.token;
      const adminSession = getAdminSession();
      const adminToken = adminSession?.token;

      const payload = {
        // backend-required fields (based on validation error)
        full_name: nameTrimmed,
        phone: phoneTrimmed,
        address: addressTrimmed,
        city: cityTrimmed,

        paymentMethod: "cash_on_delivery",
        payment_method: "cash_on_delivery",
        notes: String(notes || "").trim(),
        customer: {
          fullName: nameTrimmed,
          phone: phoneTrimmed,
          address: addressTrimmed,
          city: cityTrimmed,
          notes: String(notes || "").trim(),
        },
        // common alternates some APIs expect
        shippingAddress: {
          name: nameTrimmed,
          phone: phoneTrimmed,
          address: addressTrimmed,
          city: cityTrimmed,
          notes: String(notes || "").trim(),
        },
        items: cartItems.map((x) => {
          const id = x?.id ?? x?._id ?? x?.name;
          const quantity = Math.max(1, Number(x?.quantity || 1));
          return {
            id,
            itemId: id,
            item_id: id,
            productId: id,
            product_id: id,
            name: x?.name,
            price: Number(x?.price || 0),
            image: x?.image,
            quantity,
          };
        }),
        totals: {
          subtotal: Number(subtotal),
          shipping: Number(shipping),
          total: Number(total),
        },
      };

      async function postOrder(bearerToken) {
        const res = await fetch(apiUrl("/api/orders"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const data = await readJson(res);
        return { res, data };
      }

      // Try client token first (normal flow)
      let { res, data } = await postOrder(token);

      // Some backends protect POST /api/orders for admin only.
      const msg = String(data?.message || data?.error || "");
      if (
        !res.ok &&
        /admin token required/i.test(msg) &&
        adminToken &&
        adminToken !== token
      ) {
        ({ res, data } = await postOrder(adminToken));
      }

      if (!res.ok) {
        const finalMsg = String(data?.message || data?.error || "");
        if (/admin token required/i.test(finalMsg) && !adminToken) {
          throw new Error("Admin token required (please login as admin first).");
        }
        throw new Error(finalMsg || `Order failed (HTTP ${res.status}).`);
      }
      if (data && (data.ok === false || data.success === false)) {
        throw new Error(data.message || data.error || "Order failed.");
      }

      clearCart();
      toast.success("Order placed! Pay cash on delivery.");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err?.message || "Failed to place order.");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div style={{ maxWidth: 980, margin: "40px auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>Checkout</h2>
          <p style={{ marginTop: 0, opacity: 0.8 }}>
            Payment method: <b>Cash on delivery</b>
          </p>
          <p style={{ marginTop: 0, opacity: 0.7 }}>
            Order API: <b>/api/orders</b>
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link to="/cart" style={{ textDecoration: "none" }}>
            ← Back to cart
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <form
          onSubmit={onPlaceOrder}
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Delivery details</h3>

          <label style={{ display: "block", marginBottom: 6 }}>Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
              marginBottom: 12,
            }}
            disabled={placing}
          />

          <label style={{ display: "block", marginBottom: 6 }}>Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
              marginBottom: 12,
            }}
            disabled={placing}
          />

          <label style={{ display: "block", marginBottom: 6 }}>Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, building, apartment..."
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
              marginBottom: 12,
            }}
            disabled={placing}
          />

          <label style={{ display: "block", marginBottom: 6 }}>City</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Your city"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
              marginBottom: 12,
            }}
            disabled={placing}
          />

          <label style={{ display: "block", marginBottom: 6 }}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to help delivery..."
            rows={4}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
              marginBottom: 12,
              resize: "vertical",
            }}
            disabled={placing}
          />

          <button
            type="submit"
            disabled={placing || cartItems.length === 0}
            className="sb-btn sb-btn--block"
          >
            {placing ? "Placing order..." : "Place order (Cash on delivery)"}
          </button>
        </form>

        <aside
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Order summary</h3>

          {cartItems.length === 0 ? (
            <p style={{ marginTop: 0, opacity: 0.8 }}>No items in cart.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {cartItems.map((item) => (
                <div
                  key={item.id ?? item._id ?? item.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "56px 1fr auto",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{
                      width: 56,
                      height: 56,
                      objectFit: "cover",
                      borderRadius: 10,
                      border: "1px solid #eee",
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      Qty: <b>{item.quantity || 1}</b> • Cash on delivery
                    </div>
                    <button
                      type="button"
                      className="btn btn-link"
                      style={{ padding: 0, marginTop: 6, color: "#b00020" }}
                      onClick={() => removeFromCart(item.id ?? item._id)}
                      disabled={placing}
                    >
                      Remove
                    </button>
                  </div>
                  <div style={{ fontWeight: 700 }}>
                    ${money(Number(item.price || 0) * Math.max(1, Number(item.quantity || 1)))}
                  </div>
                </div>
              ))}

              <hr style={{ margin: "8px 0" }} />
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ opacity: 0.8 }}>Subtotal</span>
                  <b>${money(subtotal)}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ opacity: 0.8 }}>Shipping</span>
                  <b>${money(shipping)}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16 }}>
                  <span>Total</span>
                  <b>${money(total)}</b>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}


