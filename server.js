// server.js
const express = require('express');
const mysql = require('mysql');
const path = require('path');
const session = require('express-session'); // Requerir express-session

const app = express();
const port = process.env.PORT || 3000;

// Configurar express-session
app.use(session({
  secret: 'tu_secreto_aqui', // Cambia esto por una cadena secreta robusta
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Asegúrate de cambiar a true si usas HTTPS
}));

// Configuración de la base de datos
const dbConfig = {
  host: '190.228.29.61',
  user: 'kalel2016',
  password: 'Kalel2016',
  database: 'ausol'
};

// Crear un pool de conexiones
const pool = mysql.createPool(dbConfig);

// Configurar EJS como motor de vistas y la carpeta de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Servir archivos estáticos (por ejemplo, CSS)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para parsear datos del formulario
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Ruta raíz: redirige a /login
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Ruta para mostrar el formulario de login (GET)
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Ruta para procesar el login (POST)
// (Este ejemplo es básico; en producción deberías validar y proteger las credenciales)
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const query = `
    SELECT * FROM aus_usuario
    WHERE nombre = ? AND password = ?
    LIMIT 1
  `;
  pool.query(query, [username, password], (error, results) => {
    if (error) {
      console.error("Error en la consulta de login:", error);
      return res.status(500).send("Error en la base de datos");
    }
    if (results.length > 0) {
      // Guardar información en la sesión (por ejemplo, el usuario)
      req.session.user = results[0];
      return res.redirect('/inicio');
    } else {
      return res.render('login', { error: "Usuario o contraseña incorrectos" });
    }
  });
});

// Ruta para la página principal (inicio.ejs)
app.get('/inicio', (req, res) => {
  // Verifica si el usuario está autenticado (opcional, pero recomendable)
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const query = `
    SELECT 
      a.codpro, 
      p.razon, 
      IF(COUNT(*) = SUM(a.ter = 1), 'Terminado', 'En Proceso') AS estado,
      MAX(a.numero) AS numero
    FROM aus_pepend a
    JOIN aus_pro p ON a.codpro = p.codigo
    GROUP BY a.codpro, p.razon
    HAVING COUNT(*) = SUM(a.ter = 1)
  `;
  pool.query(query, (error, results) => {
    if (error) {
      console.error('Error en la consulta de encabezados: ', error);
      return res.status(500).send("Error en la base de datos");
    }
    res.render('inicio', { headers: results });
  });
});

// Endpoint para obtener los detalles de un encabezado (AJAX)
app.get('/detalle/:codpro', (req, res) => {
  // Opcional: puedes validar que el usuario esté logueado aquí también
  const codpro = req.params.codpro;
  const query = `
    SELECT 
      a.codigo, 
      a.codbar, 
      CONCAT('Pedido ', a.canped, ' Recibido ', a.cantrec) AS pendiente
    FROM aus_pepend a
    WHERE a.codpro = ? AND a.pen = 1
  `;
  pool.query(query, [codpro], (error, results) => {
    if (error) {
      console.error('Error en la consulta de detalles: ', error);
      return res.status(500).send("Error en la base de datos");
    }
    res.json(results);
  });
});

// Ruta para cerrar sesión
app.get('/logout', (req, res) => {
  // Destruir la sesión y redirigir a login
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      // En caso de error, redirige igualmente a login o muestra un mensaje
      return res.redirect('/inicio');
    }
    res.redirect('/login');
  });
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});
