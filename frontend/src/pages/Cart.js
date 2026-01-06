import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import "../bootstrap/dist/css/bootstrap.min.css";
import { isClientLoggedIn } from "../utils/clientStorage";
const Cart = () => {
  const navigate = useNavigate();
  const {
    cartItems,
    removeFromCart,
    clearCart,
    incrementQuantity,
    decrementQuantity,
  } = useContext(CartContext);

  const total = cartItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
    0
  );

  return (
    <div style={{ padding: "20px" }}>
      <h2>Your Cart 🛒</h2>

      {cartItems.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "15px" }}>
            {cartItems.map((item) => (
              <div
                key={item.id ?? item._id ?? item.name}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "10px",
                  padding: "10px",
                  width: "250px",
                }}
              >
                <img
                  src={item.image}
                  alt={item.name}
                  style={{ width: "100%", borderRadius: "10px" }}
                />
                <h4>{item.name}</h4>
                <p style={{ marginBottom: 8 }}>
                  ${item.price}{" "}
                  <span style={{ opacity: 0.8 }}>
                    × {item.quantity || 1} ={" "}
                    <b>${Number(item.price || 0) * Number(item.quantity || 1)}</b>
                  </span>
                </p>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => decrementQuantity(item.id ?? item._id)}
                    className="sb-btn sb-btn--outline"
                    style={{ padding: "8px 12px" }}
                    aria-label={`Decrease quantity of ${item.name}`}
                  >
                    −
                  </button>
                  <b style={{ minWidth: 26, textAlign: "center" }}>
                    {item.quantity || 1}
                  </b>
                  <button
                    type="button"
                    onClick={() => incrementQuantity(item.id ?? item._id)}
                    className="sb-btn"
                    style={{ padding: "8px 12px" }}
                    aria-label={`Increase quantity of ${item.name}`}
                  >
                    +
                  </button>

                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id ?? item._id)}
                    className="btn btn-outline-danger"
                    style={{ marginLeft: "auto" }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <hr style={{ margin: "20px 0" }} />
          <h3>Total: ${total}</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              className="sb-btn"
              onClick={() => {
                if (isClientLoggedIn()) {
                  navigate("/checkout");
                } else {
                  navigate("/login", { state: { from: "/checkout" } });
                }
              }}
            >
              Checkout (Cash on delivery)
            </button>
            <button onClick={clearCart} className="sb-btn sb-btn--outline">
              Clear Cart
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Cart;
