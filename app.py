# ============================================
# BACKEND API PANADERÍA - Flask
# Archivo: app.py
# ============================================

from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from mysql.connector import pooling
from contextlib import contextmanager

app = Flask(__name__)
CORS(app)  # Permite peticiones desde el frontend

# ============================================
# CONFIGURACIÓN DE BASE DE DATOS
# ============================================

DB_CONFIG = {
    'host': '127.0.0.1',
    'user': 'root',
    'password': '1234',  # CAMBIAR AQUÍ
    'database': 'panaderia_db',
    'pool_name': 'panaderia_pool',
    'pool_size': 5
}

# Pool de conexiones
connection_pool = mysql.connector.pooling.MySQLConnectionPool(**DB_CONFIG)

@contextmanager
def get_db():
    """Obtener conexión de la base de datos"""
    conn = connection_pool.get_connection()
    try:
        yield conn
    finally:
        conn.close()

# ============================================
# RUTAS - PRODUCTOS
# ============================================

@app.route('/api/productos', methods=['GET'])
def listar_productos():
    """GET - Listar todos los productos"""
    try:
        categoria = request.args.get('categoria')
        activo = request.args.get('activo')
        
        query = "SELECT * FROM productos WHERE 1=1"
        params = []
        
        if categoria:
            query += " AND categoria = %s"
            params.append(categoria)
        if activo:
            query += " AND activo = %s"
            params.append(activo.lower() == 'true')
        
        query += " ORDER BY categoria, nombre"
        
        with get_db() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(query, params)
            productos = cursor.fetchall()
        
        return jsonify({'success': True, 'data': productos})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/productos/<int:id>', methods=['GET'])
def obtener_producto(id):
    """GET - Obtener un producto específico"""
    try:
        with get_db() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM productos WHERE id = %s", (id,))
            producto = cursor.fetchone()
        
        if not producto:
            return jsonify({'success': False, 'error': 'Producto no encontrado'}), 404
        
        return jsonify({'success': True, 'data': producto})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/productos', methods=['POST'])
def crear_producto():
    """POST - Crear nuevo producto"""
    try:
        data = request.json
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO productos (nombre, categoria, precio, stock, descripcion) 
                   VALUES (%s, %s, %s, %s, %s)""",
                (data['nombre'], data['categoria'], data['precio'], 
                 data.get('stock', 0), data.get('descripcion'))
            )
            conn.commit()
            producto_id = cursor.lastrowid
        
        return jsonify({'success': True, 'data': {'id': producto_id}}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/productos/<int:id>', methods=['PUT'])
def actualizar_producto(id):
    """PUT - Actualizar producto completo"""
    try:
        data = request.json
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """UPDATE productos 
                   SET nombre=%s, categoria=%s, precio=%s, stock=%s, descripcion=%s, activo=%s 
                   WHERE id=%s""",
                (data['nombre'], data['categoria'], data['precio'], data['stock'],
                 data.get('descripcion'), data.get('activo', True), id)
            )
            conn.commit()
        
        return jsonify({'success': True, 'message': 'Producto actualizado'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================
# RUTAS - CLIENTES
# ============================================

@app.route('/api/clientes', methods=['GET'])
def listar_clientes():
    """GET - Listar todos los clientes"""
    try:
        with get_db() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM clientes ORDER BY nombre")
            clientes = cursor.fetchall()
        
        return jsonify({'success': True, 'data': clientes})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/clientes', methods=['POST'])
def crear_cliente():
    """POST - Crear nuevo cliente"""
    try:
        data = request.json
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO clientes (nombre, telefono, email, direccion) 
                   VALUES (%s, %s, %s, %s)""",
                (data['nombre'], data.get('telefono'), data.get('email'), data.get('direccion'))
            )
            conn.commit()
            cliente_id = cursor.lastrowid
        
        return jsonify({'success': True, 'data': {'id': cliente_id}}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================
# RUTAS - VENTAS
# ============================================

@app.route('/api/ventas', methods=['POST'])
def crear_venta():
    """POST - Crear venta y descontar stock automáticamente"""
    with get_db() as conn:
        cursor = conn.cursor(dictionary=True)
        try:
            conn.start_transaction()
            data = request.json
            
            # Calcular total y verificar stock
            total = 0
            for item in data['items']:
                cursor.execute(
                    "SELECT precio, stock FROM productos WHERE id = %s",
                    (item['producto_id'],)
                )
                producto = cursor.fetchone()
                
                if not producto:
                    raise Exception(f"Producto {item['producto_id']} no encontrado")
                if producto['stock'] < item['cantidad']:
                    raise Exception(f"Stock insuficiente para producto {item['producto_id']}")
                
                total += float(producto['precio']) * item['cantidad']
            
            # Crear venta
            cursor.execute(
                "INSERT INTO ventas (cliente_id, total, tipo_entrega) VALUES (%s, %s, %s)",
                (data.get('cliente_id'), total, data['tipo_entrega'])
            )
            venta_id = cursor.lastrowid
            
            # Insertar items y descontar stock
            for item in data['items']:
                cursor.execute("SELECT precio FROM productos WHERE id = %s", (item['producto_id'],))
                precio = float(cursor.fetchone()['precio'])
                subtotal = precio * item['cantidad']
                
                cursor.execute(
                    """INSERT INTO venta_items 
                       (venta_id, producto_id, cantidad, precio_unitario, subtotal) 
                       VALUES (%s, %s, %s, %s, %s)""",
                    (venta_id, item['producto_id'], item['cantidad'], precio, subtotal)
                )
                
                cursor.execute(
                    "UPDATE productos SET stock = stock - %s WHERE id = %s",
                    (item['cantidad'], item['producto_id'])
                )
            
            conn.commit()
            return jsonify({
                'success': True,
                'data': {'venta_id': venta_id, 'total': total}
            }), 201
            
        except Exception as e:
            conn.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/ventas', methods=['GET'])
def listar_ventas():
    """GET - Listar todas las ventas"""
    try:
        with get_db() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("""
                SELECT v.*, c.nombre as cliente_nombre 
                FROM ventas v 
                LEFT JOIN clientes c ON v.cliente_id = c.id 
                ORDER BY v.created_at DESC
            """)
            ventas = cursor.fetchall()
        
        return jsonify({'success': True, 'data': ventas})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/ventas/<int:id>', methods=['GET'])
def obtener_venta(id):
    """GET - Obtener detalle completo de una venta"""
    try:
        with get_db() as conn:
            cursor = conn.cursor(dictionary=True)
            
            # Obtener venta
            cursor.execute("""
                SELECT v.*, c.nombre as cliente_nombre, c.telefono 
                FROM ventas v 
                LEFT JOIN clientes c ON v.cliente_id = c.id 
                WHERE v.id = %s
            """, (id,))
            venta = cursor.fetchone()
            
            if not venta:
                return jsonify({'success': False, 'error': 'Venta no encontrada'}), 404
            
            # Obtener items
            cursor.execute("""
                SELECT vi.*, p.nombre as producto_nombre 
                FROM venta_items vi 
                JOIN productos p ON vi.producto_id = p.id 
                WHERE vi.venta_id = %s
            """, (id,))
            venta['items'] = cursor.fetchall()
        
        return jsonify({'success': True, 'data': venta})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================
# RUTAS - DELIVERIES
# ============================================

@app.route('/api/deliveries', methods=['POST'])
def crear_delivery():
    """POST - Crear registro de delivery"""
    try:
        data = request.json
        
        with get_db() as conn:
            cursor = conn.cursor(dictionary=True)
            
            # Verificar que es venta tipo delivery
            cursor.execute(
                "SELECT * FROM ventas WHERE id = %s AND tipo_entrega = 'delivery'",
                (data['venta_id'],)
            )
            if not cursor.fetchone():
                return jsonify({
                    'success': False,
                    'error': 'Venta no encontrada o no es tipo delivery'
                }), 404
            
            cursor.execute(
                """INSERT INTO deliveries (venta_id, direccion, referencias, fecha_entrega) 
                   VALUES (%s, %s, %s, %s)""",
                (data['venta_id'], data['direccion'], 
                 data.get('referencias'), data.get('fecha_entrega'))
            )
            conn.commit()
            delivery_id = cursor.lastrowid
        
        return jsonify({'success': True, 'data': {'id': delivery_id}}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/deliveries', methods=['GET'])
def listar_deliveries():
    """GET - Listar deliveries"""
    try:
        estado = request.args.get('estado')
        
        query = """
            SELECT d.*, v.total, c.nombre as cliente_nombre, c.telefono 
            FROM deliveries d 
            JOIN ventas v ON d.venta_id = v.id 
            LEFT JOIN clientes c ON v.cliente_id = c.id
        """
        params = []
        
        if estado:
            query += " WHERE d.estado = %s"
            params.append(estado)
        
        query += " ORDER BY d.created_at DESC"
        
        with get_db() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(query, params)
            deliveries = cursor.fetchall()
        
        return jsonify({'success': True, 'data': deliveries})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/deliveries/<int:id>/estado', methods=['PATCH'])
def actualizar_estado_delivery(id):
    """PATCH - Actualizar estado de delivery"""
    try:
        data = request.json
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE deliveries SET estado = %s WHERE id = %s",
                (data['estado'], id)
            )
            conn.commit()
        
        return jsonify({'success': True, 'message': 'Estado actualizado'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================
# INICIAR SERVIDOR
# ============================================

if __name__ == '__main__':
    print('🍞 Servidor API iniciado en http://localhost:5000')
    print('📚 Documentación: Ver archivo ENDPOINTS.txt')
    app.run(debug=True, host='0.0.0.0', port=5000)