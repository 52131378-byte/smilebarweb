import "../Assets/ProductCard.css";
import React, { useContext } from "react";
import { CartContext } from "../context/CartContext";
import { apiUrl } from "../utils/apiBase";

const ProductCard = ({ product }) => {
  const { addToCart } = useContext(CartContext);
  if (!product) {
    return <div className="product-card">No product data</div>;
  }
  const imageSrc =
    typeof product.image === "string" && product.image.startsWith("/uploads/")
      ? apiUrl(product.image)
      : product.image;
  const handleAdd = () => {
    addToCart(product);
  };
  return (
    <div className="card">
      <img src={imageSrc} alt={product.name} className="card-img" />
      <h3>{product.name}</h3>
      <p>${product.price}</p>
      <button onClick={handleAdd} className="buy-btn">
        Add to Cart
      </button>
    </div>
  );
};

export default ProductCard;
