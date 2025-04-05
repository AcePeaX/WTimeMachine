import React, { useEffect, useRef } from "react";
import "./Modal.css";

const Modal = ({ isOpen, onClose, children }) => {
    const modalRef = useRef();

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) {
                if(typeof onClose === 'function') {
                    onClose();
                }
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleOutsideClick);
        } else {
            document.removeEventListener("mousedown", handleOutsideClick);
        }

        return () =>
            document.removeEventListener("mousedown", handleOutsideClick);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" ref={modalRef}>
                {onClose ? <button className="modal-close" onClick={onClose}>
                    ×
                </button> : null}
                {children}
            </div>
        </div>
    );
};

export default Modal;
