import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import "../Assets/Navbar.css";
import { useContext, useEffect, useMemo, useState } from "react";
import { CartContext } from "../context/CartContext";
import { clientLogoutApi, getClientSession } from "../utils/clientStorage";
import { adminLogoutApi, getAdminSession } from "../utils/adminStorage";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const { cartItems } = useContext(CartContext);
  const cartCount = useMemo(() => {
    const items = cartItems || [];
    return items.reduce(
      (sum, item) => sum + Math.max(1, Number(item?.quantity || 1)),
      0
    );
  }, [cartItems]);

  const clientSession = useMemo(() => getClientSession(), [location.pathname]);
  const clientName =
    clientSession?.user?.name || clientSession?.user?.email || "Client";

  const adminSession = useMemo(() => getAdminSession(), [location.pathname]);
  const adminName = adminSession?.username || "Admin";

  useEffect(() => {
    // Close the mobile menu on navigation.
    setMenuOpen(false);
  }, [location.pathname]);

  const navLinkClass = ({ isActive }) =>
    `navbar__link${isActive ? " is-active" : ""}`;

  return (
    <header className="navbar" role="banner">
      <nav className="navbar__inner" aria-label="Main navigation">
        <div className="navbar__left">
          <Link to="/" className="navbar__brand" aria-label="SmileBAR home">
            <img src="/logo.png" alt="SmileBAR logo" className="navbar__logo" />
            <span className="navbar__title">SmileBAR</span>
          </Link>
        </div>

        <div className="navbar__center">
          <div
            id="primary-navigation"
            className={`navbar__links${menuOpen ? " is-open" : ""}`}
          >
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/products" className={navLinkClass}>
              Products
            </NavLink>
            <NavLink to="/contact" className={navLinkClass}>
              Contact
            </NavLink>
            {clientSession ? (
              <NavLink to="/my-orders" className={navLinkClass}>
                My Orders
              </NavLink>
            ) : null}
            {!clientSession ? (
              <>
                <NavLink to="/login" className={navLinkClass}>
                  Login
                </NavLink>
                <NavLink to="/register" className={navLinkClass}>
                  Register
                </NavLink>
              </>
            ) : null}
          </div>
        </div>

        <div className="navbar__right">
          {adminSession ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  opacity: 0.98,
                  maxWidth: 160,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={adminName}
              >
                Admin: {adminName}
              </span>
              <button
                type="button"
                className="sb-btn sb-btn--outline"
                style={{ padding: "8px 12px" }}
                onClick={async () => {
                  await adminLogoutApi();
                  navigate("/admin/login", { replace: true });
                }}
              >
                Logout
              </button>
            </div>
          ) : null}

          {clientSession ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  opacity: 0.95,
                  maxWidth: 160,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={clientName}
              >
                Hi, {clientName}
              </span>
              <button
                type="button"
                className="sb-btn sb-btn--outline"
                style={{ padding: "8px 12px" }}
                onClick={async () => {
                  await clientLogoutApi();
                  navigate("/", { replace: true });
                }}
              >
                Logout
              </button>
            </div>
          ) : null}

          <NavLink
            to="/cart"
            className={({ isActive }) =>
              `navbar__link navbar__cart${isActive ? " is-active" : ""}`
            }
          >
            <span className="navbar__cartIcon" aria-hidden="true">
              🛒
            </span>
            <span>Add to cart</span>
            <span
              className="navbar__badge"
              aria-label={`${cartCount} items in cart`}
            >
              {cartCount}
            </span>
          </NavLink>

          <button
            type="button"
            className="navbar__toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="navbar__toggleIcon" aria-hidden="true" />
          </button>
        </div>
      </nav>
    </header>
  );
}
