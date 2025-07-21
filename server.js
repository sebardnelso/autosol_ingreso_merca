const express = require('express');
const mysql = require('mysql');
const path = require('path');
const session = require('express-session'); // Requerir express-session

const app = express();
const port = process.env.PORT || 3001;

// Configurar express-session
app.use(session({
  secret: 'Seba014', // Cambia esto por una cadena secreta robusta
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
      return res.redirect('/menu'); // Redirigir a /menu en caso de login exitoso
    } else {
      return res.render('login', { error: "Usuario o contraseña incorrectos" });
    }
  });
});

// Ruta para mostrar el menú principal (menu.ejs)
app.get('/menu', (req, res) => {
  if (!req.session.user) return res.redirect('/login'); // Verifica que el usuario esté logueado
  res.render('menu'); // renderiza el archivo menu.ejs
});

// Ruta para la página principal (inicio.ejs)
app.get('/inicio', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const query = `
    SELECT 
      a.codpro, 
      p.razon, 
      CASE 
        WHEN MIN(a.ter) = 1 AND MAX(a.ter) = 1 THEN 'Terminado'
        ELSE 'En Proceso'
      END AS estado,
      a.numero,
      MAX(a.fecha) AS fecha,
      MAX(a.hora) AS hora,
      MAX(a.usuario) AS usuario
    FROM aus_pepend a
    JOIN aus_pro p ON a.codpro = p.codigo
    GROUP BY a.codpro, p.razon, a.numero
    HAVING SUM(CASE WHEN a.ter = 1 THEN 1 ELSE 0 END) > 0
  `;

  pool.query(query, (error, results) => {
    if (error) {
      console.error('Error en la consulta de encabezados: ', error);
      return res.status(500).send("Error en la base de datos");
    }
    res.render('inicio', { headers: results });
  });
});

// Ruta para la página de pedidos (pedidos.ejs)
app.get('/pedidos', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const query = `
    SELECT * FROM aus_pepend
  `;
  pool.query(query, (error, results) => {
    if (error) {
      console.error('Error en la consulta de pedidos: ', error);
      return res.status(500).send("Error en la base de datos");
    }
    res.render('pedidos', { pedidos: results });
  });
});

// Endpoint para obtener los detalles de un encabezado (AJAX)
app.get('/detalle/:codpro', (req, res) => {
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


// Ruta para la página de pedidos (pedidos.ejs)
// Ruta para la página de pedidos (pedidos.ejs)
app.get('/pedidoscelu', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  // Filtros recibidos desde la vista
  const { 
    fecha, 
    codcli, 
    codcli_value, 
    pendienteFacturar, 
    pendientePreparar, 
    todo, 
    soloMisiones, 
    soloCorrientes 
  } = req.query;

  // Verificar que la fecha sea válida
  if (!fecha) {
    return res.status(400).send("La fecha es obligatoria.");
  }

  // Mostrar los parámetros recibidos para depuración
  console.log('Parametros recibidos: ', req.query);

  let query = 
    SELECT 
      a.fecha, 
      a.numped, 
      a.codcli, 
      a.transporte, 
      a.hora, 
      a.realiza, 
      a.hecho, 
      a.zona
    FROM aus_ped a
    WHERE a.fecha = ? 
  ;

  const params = [fecha]; // Iniciar los parámetros con la fecha

  // Filtrar por código de cliente si se selecciona
  if (codcli && codcli_value) {
    query +=  AND a.codcli = ? ;
    params.push(codcli_value); // Agregar codcli_value a los parámetros
  }

  // Filtro de "pendiente a facturar" (hecho = 0)
  if (pendienteFacturar) {
    query +=  AND a.hecho = 0 ;
  }

  // Filtro de "pendiente a preparar" (realiza IS NULL)
  if (pendientePreparar) {
    query +=  AND (a.realiza IS NULL OR a.realiza = '') ;
  }

  // Filtro por "solo Misiones" (zona = 1)
  if (soloMisiones) {
    query +=  AND a.zona = 1 ;
  }

  // Filtro por "solo Corrientes" (zona = 2)
  if (soloCorrientes) {
    query +=  AND a.zona = 2 ;
  }

  // Filtro por "todo de todo"
  if (todo) {
    // No aplica filtros adicionales
  }

  // Agrupar por código de cliente
  query +=  GROUP BY a.codcli;
  query +=  GROUP BY a.numped;

  // Mostrar la consulta generada para depuración
  console.log('Consulta SQL generada: ', query);
  console.log('Parametros SQL: ', params);

  pool.query(query, params, (error, results) => {
    if (error) {
      console.error('Error en la consulta de pedidos: ', error);
      return res.status(500).send("Error en la base de datos");
    }

    // Formatear las fechas antes de enviarlas a la vista
    results.forEach(pedido => {
      if (!pedido.fecha || pedido.fecha === '0000-00-00') {
        pedido.fecha = 'Sin Fecha';
      } else {
        const date = new Date(pedido.fecha);
        if (isNaN(date)) {
          pedido.fecha = 'Sin Fecha';
        } else {
          const formattedDate = ${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()};
          pedido.fecha = formattedDate;
        }
      }
      
      if (!pedido.hora || pedido.hora === 'NULL' || pedido.hora === '') {
        pedido.hora = 'No disponible';
      }
    });

    res.render('pedidos', { pedidos: results });
  });
});













// Endpoint para obtener los detalles de un pedido por código de cliente
app.get('/detalle/:codcli/:numped', (req, res) => {
  const { codcli, numped } = req.params;
  const query = `
    SELECT 
      a.codori, 
      a.cantidad, 
      a.stock, 
      a.codbarped, 
      a.cantidad_real
    FROM aus_ped a
    WHERE a.codcli = ? AND a.numped = ?
  `;
  
  pool.query(query, [codcli, numped], (error, results) => {
    if (error) {
      console.error('Error en la consulta de detalles del pedido: ', error);
      return res.status(500).send("Error en la base de datos");
    }

    if (results.length > 0) {
      res.json(results);  // Devuelve los detalles del pedido
    } else {
      res.status(404).send("Detalles no encontrados");
    }
  });
});




// Ruta para cerrar sesión
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.redirect('/inicio');
    }
    res.redirect('/login');
  });
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});
