// ============================================
// JAVASCRIPT FRONTEND - Sistema Panadería
// Archivo: app.js
// ============================================

const API_URL = 'http://localhost:5000/api';
let productos = [];
let clientes = [];

// ============================================
// FUNCIONES GENERALES
// ============================================

function cambiarTab(seccion, event) {
    // Cambiar tabs activas
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    
    // Activar la pestaña clickeada
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    document.getElementById(seccion).classList.add('active');
    
    // Cargar datos de la sección
    switch(seccion) {
        case 'productos':
            cargarProductos();
            break;
        case 'clientes':
            cargarClientes();
            break;
        case 'ventas':
            cargarVentas();
            cargarClientesSelect();
            cargarProductosVenta();
            break;
        case 'deliveries':
            cargarDeliveries();
            break;
    }
}

function mostrarMensaje(texto, tipo) {
    const mensaje = document.getElementById('mensaje');
    mensaje.textContent = texto;
    mensaje.className = tipo;
    mensaje.style.display = 'block';
    
    setTimeout(() => {
        mensaje.style.display = 'none';
    }, 5000);
}

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Error en la operación');
        }
        
        return data;
    } catch (error) {
        mostrarMensaje('Error: ' + error.message, 'error');
        throw error;
    }
}

// ============================================
// PRODUCTOS
// ============================================

async function cargarProductos() {
    try {
        const data = await fetchAPI('/productos');
        productos = data.data;
        
        const lista = document.getElementById('listaProductos');
        lista.innerHTML = '';
        
        productos.forEach(producto => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <h3>${producto.nombre}</h3>
                <div class="badge ${producto.activo ? 'badge-success' : 'badge-danger'}">
                    ${producto.categoria}
                </div>
                <div class="precio">$${parseFloat(producto.precio).toFixed(3)}</div>
                <div class="stock">Stock: ${producto.stock} unidades</div>
                <p style="color: #666; margin-top: 10px; font-size: 14px;">
                    ${producto.descripcion || 'Sin descripción'}
                </p>
            `;
            lista.appendChild(card);
        });
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
}

document.getElementById('formProducto').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const producto = {
            nombre: document.getElementById('nombreProducto').value,
            categoria: document.getElementById('categoriaProducto').value,
            precio: parseFloat(document.getElementById('precioProducto').value),
            stock: parseInt(document.getElementById('stockProducto').value) || 0,
            descripcion: document.getElementById('descripcionProducto').value
        };
        
        await fetchAPI('/productos', {
            method: 'POST',
            body: JSON.stringify(producto)
        });
        
        mostrarMensaje('Producto creado exitosamente', 'success');
        e.target.reset();
        cargarProductos();
    } catch (error) {
        console.error('Error al crear producto:', error);
    }
});

// ============================================
// CLIENTES
// ============================================

async function cargarClientes() {
    try {
        const data = await fetchAPI('/clientes');
        clientes = data.data;
        
        const tbody = document.querySelector('#tablaClientes tbody');
        tbody.innerHTML = '';
        
        clientes.forEach(cliente => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${cliente.id}</td>
                <td>${cliente.nombre}</td>
                <td>${cliente.telefono || '-'}</td>
                <td>${cliente.email || '-'}</td>
                <td>${cliente.direccion || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error al cargar clientes:', error);
    }
}

document.getElementById('formCliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const cliente = {
            nombre: document.getElementById('nombreCliente').value,
            telefono: document.getElementById('telefonoCliente').value,
            email: document.getElementById('emailCliente').value,
            direccion: document.getElementById('direccionCliente').value
        };
        
        await fetchAPI('/clientes', {
            method: 'POST',
            body: JSON.stringify(cliente)
        });
        
        mostrarMensaje('Cliente registrado exitosamente', 'success');
        e.target.reset();
        cargarClientes();
    } catch (error) {
        console.error('Error al registrar cliente:', error);
    }
});

// ============================================
// VENTAS
// ============================================

let carrito = [];

function cargarClientesSelect() {
    const select = document.getElementById('clienteVenta');
    select.innerHTML = '<option value="">Sin cliente</option>';
    
    clientes.forEach(cliente => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = cliente.nombre;
        select.appendChild(option);
    });
}

function cargarProductosVenta() {
    const container = document.getElementById('productosVenta');
    container.innerHTML = '';
    
    const filtro = document.getElementById('filtroCategoria').value;
    const productosDisponibles = productos.filter(p => 
        p.activo && (!filtro || p.categoria === filtro)
    );
    
    productosDisponibles.forEach(producto => {
        const card = document.createElement('div');
        card.className = `producto-venta ${producto.stock === 0 ? 'sin-stock' : ''}`;
        
        // Emojis por categoría
        const emojis = {
            'pan': '🥖',
            'torta': '🎂',
            'postre': '🍰',
            'otro': '🧁'
        };
        
        card.innerHTML = `
            <div class="imagen">${emojis[producto.categoria] || '🍞'}</div>
            <h4>${producto.nombre}</h4>
            <div class="precio-venta">${parseFloat(producto.precio).toFixed(3)}</div>
            <div class="stock-venta">Stock: ${producto.stock}</div>
            <div class="badge ${producto.stock > 0 ? 'badge-success' : 'badge-danger'}" style="margin-top: 8px;">
                ${producto.categoria}
            </div>
        `;
        
        if (producto.stock > 0) {
            card.onclick = () => agregarAlCarrito(producto);
        }
        
        container.appendChild(card);
    });
}

function filtrarProductosVenta() {
    cargarProductosVenta();
}

function agregarAlCarrito(producto) {
    // Verificar si ya está en el carrito
    const itemExistente = carrito.find(item => item.producto.id === producto.id);
    
    if (itemExistente) {
        if (itemExistente.cantidad < producto.stock) {
            itemExistente.cantidad++;
        } else {
            mostrarMensaje('No hay más stock disponible', 'error');
            return;
        }
    } else {
        carrito.push({
            producto: producto,
            cantidad: 1
        });
    }
    
    actualizarCarrito();
}

function actualizarCarrito() {
    const container = document.getElementById('carritoItems');
    const carritoVacio = document.getElementById('carritoVacio');
    
    if (carrito.length === 0) {
        container.style.display = 'none';
        carritoVacio.style.display = 'block';
        document.getElementById('totalVenta').textContent = '0.00';
        return;
    }
    
    container.style.display = 'block';
    carritoVacio.style.display = 'none';
    container.innerHTML = '';
    
    let total = 0;
    
    carrito.forEach((item, index) => {
        const subtotal = item.producto.precio * item.cantidad;
        total += subtotal;
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'carrito-item';
        itemDiv.innerHTML = `
            <div class="carrito-item-info">
                <strong>${item.producto.nombre}</strong><br>
                <small>${parseFloat(item.producto.precio).toFixed(3)} c/u</small><br>
                <small style="color: #28a745;">Subtotal: ${subtotal.toFixed(3)}</small>
            </div>
            <div class="carrito-item-controls">
                <button class="btn-cantidad" onclick="cambiarCantidad(${index}, -1)">-</button>
                <span class="cantidad-display">${item.cantidad}</span>
                <button class="btn-cantidad" onclick="cambiarCantidad(${index}, 1)">+</button>
                <button class="btn-eliminar" onclick="eliminarDelCarrito(${index})">✕</button>
            </div>
        `;
        container.appendChild(itemDiv);
    });
    
    document.getElementById('totalVenta').textContent = total.toFixed(3);
}

function cambiarCantidad(index, cambio) {
    const item = carrito[index];
    const nuevaCantidad = item.cantidad + cambio;
    
    if (nuevaCantidad <= 0) {
        eliminarDelCarrito(index);
        return;
    }
    
    if (nuevaCantidad > item.producto.stock) {
        mostrarMensaje('No hay suficiente stock', 'error');
        return;
    }
    
    item.cantidad = nuevaCantidad;
    actualizarCarrito();
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarCarrito();
}

function limpiarCarrito() {
    carrito = [];
    actualizarCarrito();
    mostrarMensaje('Carrito limpiado', 'success');
}

async function completarVenta() {
    if (carrito.length === 0) {
        mostrarMensaje('El carrito está vacío', 'error');
        return;
    }
    
    try {
        const items = carrito.map(item => ({
            producto_id: item.producto.id,
            cantidad: item.cantidad
        }));
        
        const venta = {
            cliente_id: document.getElementById('clienteVenta').value || null,
            tipo_entrega: document.getElementById('tipoEntrega').value,
            items: items
        };
        
        const result = await fetchAPI('/ventas', {
            method: 'POST',
            body: JSON.stringify(venta)
        });
        
        mostrarMensaje(`✅ Venta #${result.data.venta_id} completada. Total: ${result.data.total.toFixed(3)}`, 'success');
        
        // Limpiar
        carrito = [];
        actualizarCarrito();
        document.getElementById('clienteVenta').value = '';
        document.getElementById('tipoEntrega').value = 'mostrador';
        
        // Recargar datos
        cargarVentas();
        cargarProductos();
        cargarProductosVenta();
        
    } catch (error) {
        console.error('Error al completar venta:', error);
    }
}

async function cargarVentas() {
    try {
        const data = await fetchAPI('/ventas');
        const tbody = document.querySelector('#tablaVentas tbody');
        tbody.innerHTML = '';
        
        data.data.forEach(venta => {
            const tr = document.createElement('tr');
            
            let estadoBadge = '';
            switch(venta.estado) {
                case 'completada':
                    estadoBadge = '<span class="badge badge-success">Completada</span>';
                    break;
                case 'pendiente':
                    estadoBadge = '<span class="badge badge-warning">Pendiente</span>';
                    break;
                case 'cancelada':
                    estadoBadge = '<span class="badge badge-danger">Cancelada</span>';
                    break;
            }
            
            tr.innerHTML = `
                <td>${venta.id}</td>
                <td>${venta.cliente_nombre || 'Sin cliente'}</td>
                <td>$${parseFloat(venta.total).toFixed(3)}</td>
                <td>${venta.tipo_entrega}</td>
                <td>${estadoBadge}</td>
                <td>${new Date(venta.created_at).toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error al cargar ventas:', error);
    }
}

// ============================================
// DELIVERIES
// ============================================

document.getElementById('formDelivery').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const delivery = {
            venta_id: parseInt(document.getElementById('ventaIdDelivery').value),
            direccion: document.getElementById('direccionDelivery').value,
            referencias: document.getElementById('referenciasDelivery').value,
            fecha_entrega: document.getElementById('fechaDelivery').value || null
        };
        
        await fetchAPI('/deliveries', {
            method: 'POST',
            body: JSON.stringify(delivery)
        });
        
        mostrarMensaje('Delivery registrado exitosamente', 'success');
        e.target.reset();
        cargarDeliveries();
    } catch (error) {
        console.error('Error al registrar delivery:', error);
    }
});

async function cargarDeliveries() {
    try {
        const data = await fetchAPI('/deliveries');
        const tbody = document.querySelector('#tablaDeliveries tbody');
        tbody.innerHTML = '';
        
        data.data.forEach(delivery => {
            const tr = document.createElement('tr');
            
            let estadoBadge = '';
            switch(delivery.estado) {
                case 'pendiente':
                    estadoBadge = '<span class="badge badge-warning">Pendiente</span>';
                    break;
                case 'en_camino':
                    estadoBadge = '<span class="badge" style="background: #17a2b8; color: white;">En Camino</span>';
                    break;
                case 'entregado':
                    estadoBadge = '<span class="badge badge-success">Entregado</span>';
                    break;
                case 'cancelado':
                    estadoBadge = '<span class="badge badge-danger">Cancelado</span>';
                    break;
            }
            
            tr.innerHTML = `
                <td>${delivery.id}</td>
                <td>${delivery.cliente_nombre || '-'}</td>
                <td>${delivery.telefono || '-'}</td>
                <td>${delivery.direccion}</td>
                <td>$${parseFloat(delivery.total).toFixed(3)}</td>
                <td>${estadoBadge}</td>
                <td>
                    <select onchange="actualizarEstadoDelivery(${delivery.id}, this.value)">
                        <option value="pendiente" ${delivery.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="en_camino" ${delivery.estado === 'en_camino' ? 'selected' : ''}>En Camino</option>
                        <option value="entregado" ${delivery.estado === 'entregado' ? 'selected' : ''}>Entregado</option>
                        <option value="cancelado" ${delivery.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error al cargar deliveries:', error);
    }
}

async function actualizarEstadoDelivery(id, estado) {
    try {
        await fetchAPI(`/deliveries/${id}/estado`, {
            method: 'PATCH',
            body: JSON.stringify({ estado })
        });
        
        mostrarMensaje('Estado actualizado correctamente', 'success');
        cargarDeliveries();
    } catch (error) {
        console.error('Error al actualizar estado:', error);
    }
}

// ============================================
// INICIALIZAR APLICACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    cargarProductos();
    cargarClientes();
});