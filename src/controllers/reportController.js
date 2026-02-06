const Report = require('../models/Report');
const User = require('../models/User');
const ChatMessage = require('../models/ChatMessage');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const ChatRoom = require('../models/ChatRoom');
const ModerationAction = require('../models/ModerationAction');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de multer para evidencia de reportes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/reports');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'evidence-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadEvidence = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido para evidencia'));
    }
  }
});

class ReportController {
  // Crear nuevo reporte
  async createReport(req, res) {
    try {
      const { targetType, targetId, category, description, severity = 5 } = req.body;
      
      // Validaciones
      if (!targetType || !targetId || !category || !description) {
        return res.status(400).json({
          success: false,
          message: 'Todos los campos son requeridos'
        });
      }
      
      if (description.length < 10 || description.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'La descripción debe tener entre 10 y 500 caracteres'
        });
      }
      
      // Verificar que el objetivo existe
      let targetModel;
      switch (targetType) {
        case 'user':
          targetModel = User;
          break;
        case 'message':
          targetModel = ChatMessage;
          break;
        case 'post':
          targetModel = Post;
          break;
        case 'comment':
          targetModel = Comment;
          break;
        case 'chatRoom':
          targetModel = ChatRoom;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Tipo de objetivo no válido'
          });
      }
      
      const target = await targetModel.findById(targetId);
      if (!target) {
        return res.status(404).json({
          success: false,
          message: 'El objetivo reportado no existe'
        });
      }
      
      // No reportarse a sí mismo
      if (targetType === 'user' && targetId === req.user.userId.toString()) {
        return res.status(400).json({
          success: false,
          message: 'No puedes reportarte a ti mismo'
        });
      }
      
      // Verificar si ya existe un reporte pendiente del mismo usuario
      const existingReport = await Report.findOne({
        reporter: req.user.userId,
        targetType,
        targetId,
        status: { $in: ['pending', 'under_review'] }
      });
      
      if (existingReport) {
        return res.status(400).json({
          success: false,
          message: 'Ya tienes un reporte pendiente para este contenido'
        });
      }
      
      // Crear reporte
      const report = new Report({
        reporter: req.user.userId,
        targetType,
        targetId,
        category,
        description,
        severity: Math.max(1, Math.min(10, severity))
      });
      
      // Ajustar prioridad basada en categoría y severidad
      if (['threats', 'violence', 'self_harm'].includes(category) || severity >= 8) {
        report.priority = 'critical';
      } else if (['harassment', 'hate_speech', 'adult_content'].includes(category) || severity >= 6) {
        report.priority = 'high';
      }
      
      await report.save();
      await report.populate('reporter', 'username profileImage');
      
      // Notificar a administradores vía Socket.IO
      if (global.io) {
        const admins = await User.find({ role: { $in: ['admin', 'moderator'] } });
        
        admins.forEach(admin => {
          global.io.emit(`admin:${admin._id}:new_report`, {
            reportId: report._id,
            type: report.targetType,
            category: report.category,
            priority: report.priority,
            reporter: {
              username: req.user.username,
              name: req.user.name
            },
            createdAt: report.createdAt
          });
        });
      }
      
      res.status(201).json({
        success: true,
        message: 'Reporte creado correctamente',
        data: report
      });
    } catch (error) {
      console.error('Error creating report:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear el reporte'
      });
    }
  }

  // Subir evidencia para reporte
  uploadEvidence(req, res) {
    uploadEvidence.array('evidence', 5)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: 'Error al subir evidencia: ' + err.message
        });
      }
      
      try {
        const { reportId } = req.params;
        const files = req.files;
        
        if (!files || files.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No se proporcionó ninguna evidencia'
          });
        }
        
        const report = await Report.findById(reportId);
        if (!report) {
          // Eliminar archivos si no existe el reporte
          files.forEach(file => fs.unlinkSync(file.path));
          return res.status(404).json({
            success: false,
            message: 'Reporte no encontrado'
          });
        }
        
        // Verificar que el reporte pertenece al usuario o es admin
        if (report.reporter.toString() !== req.user._id.toString() && 
            !['admin', 'moderator'].includes(req.user.role)) {
          // Eliminar archivos si no tiene permisos
          files.forEach(file => fs.unlinkSync(file.path));
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para agregar evidencia a este reporte'
          });
        }
        
        // Agregar evidencia al reporte
        const evidenceItems = files.map(file => ({
          type: file.mimetype.startsWith('image/') ? 'screenshot' : 'file',
          url: `/uploads/reports/${file.filename}`,
          description: `Evidencia subida: ${file.originalname}`
        }));
        
        report.evidence.push(...evidenceItems);
        await report.save();
        
        res.json({
          success: true,
          message: 'Evidencia agregada correctamente',
          data: evidenceItems
        });
      } catch (error) {
        console.error('Error uploading evidence:', error);
        // Eliminar archivos si hay error
        if (req.files) {
          req.files.forEach(file => {
            try { fs.unlinkSync(file.path); } catch (e) {}
          });
        }
        res.status(500).json({
          success: false,
          message: 'Error al subir evidencia'
        });
      }
    });
  }

  // Obtener reportes del usuario
  async getUserReports(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const status = req.query.status;
      
      const query = { reporter: req.user.userId };
      if (status) {
        query.status = status;
      }
      
      const reports = await Report.find(query)
        .populate('targetId')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      
      const total = await Report.countDocuments(query);
      
      res.json({
        success: true,
        data: reports,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error getting user reports:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener los reportes'
      });
    }
  }

  // Obtener reportes pendientes (solo admin/moderator)
  async getPendingReports(req, res) {
    try {
      if (!['admin', 'moderator', 'Admin', 'GameMaster'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver reportes pendientes'
        });
      }
      
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const priority = req.query.priority;
      const category = req.query.category;
      
      const query = { status: 'pending' };
      if (priority) query.priority = priority;
      if (category) query.category = category;
      
      const reports = await Report.find(query)
        .populate('reporter', 'username profileImage')
        .populate('reviewedBy', 'username profileImage')
        .sort({ priority: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      
      const total = await Report.countDocuments(query);
      
      // Enriquecer con información del objetivo
      const enrichedReports = await Promise.all(reports.map(async (report) => {
        let targetInfo = null;
        
        try {
          switch (report.targetType) {
            case 'user':
              targetInfo = await User.findById(report.targetId, 'username profileImage role');
              break;
            case 'message':
              targetInfo = await ChatMessage.findById(report.targetId)
                .populate('sender', 'username profileImage')
                .populate('chatRoom');
              break;
            case 'post':
              targetInfo = await Post.findById(report.targetId)
                .populate('author', 'username profileImage');
              break;
            case 'comment':
              targetInfo = await Comment.findById(report.targetId)
                .populate('author', 'username profileImage')
                .populate('post');
              break;
            case 'chatRoom':
              targetInfo = await ChatRoom.findById(report.targetId)
                .populate('participants.user', 'username profileImage');
              break;
          }
        } catch (e) {
          console.error('Error populating target:', e);
        }
        
        return {
          ...report.toObject(),
          targetInfo
        };
      }));
      
      res.json({
        success: true,
        data: enrichedReports,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error getting pending reports:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener reportes pendientes'
      });
    }
  }

  // Obtener detalles de un reporte
  async getReportDetails(req, res) {
    try {
      const { reportId } = req.params;
      
      const report = await Report.findById(reportId)
        .populate('reporter', 'username profileImage email')
        .populate('reviewedBy', 'username profileImage email')
        .populate('actionsTaken.appliedBy', 'username profileImage');
      
      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Reporte no encontrado'
        });
      }
      
      // Verificar permisos
      const canView = report.reporter._id.toString() === req.user.userId.toString() || 
                     ['admin', 'moderator', 'Admin', 'GameMaster'].includes(req.user.role);
      
      if (!canView) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver este reporte'
        });
      }
      
      // Obtener información del objetivo
      let targetInfo = null;
      try {
        switch (report.targetType) {
          case 'user':
            targetInfo = await User.findById(report.targetId, 'username profileImage email role');
            break;
          case 'message':
            targetInfo = await ChatMessage.findById(report.targetId)
              .populate('sender', 'username profileImage email')
              .populate('chatRoom');
            break;
          case 'post':
            targetInfo = await Post.findById(report.targetId)
              .populate('author', 'username profileImage email');
            break;
          case 'comment':
            targetInfo = await Comment.findById(report.targetId)
              .populate('author', 'username profileImage email')
              .populate('post');
            break;
          case 'chatRoom':
            targetInfo = await ChatRoom.findById(report.targetId)
              .populate('participants.user', 'username profileImage email')
              .populate('createdBy');
            break;
        }
      } catch (e) {
        console.error('Error getting target info:', e);
      }
      
      // Obtener reportes previos del mismo objetivo
      const previousReports = await Report.find({
        _id: { $ne: reportId },
        targetType: report.targetType,
        targetId: report.targetId,
        status: { $ne: 'dismissed' }
      }).populate('reporter', 'username profileImage');
      
      res.json({
        success: true,
        data: {
          ...report.toObject(),
          targetInfo,
          previousReports
        }
      });
    } catch (error) {
      console.error('Error getting report details:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener detalles del reporte'
      });
    }
  }

  // Revisar reporte (solo admin/moderator)
  async reviewReport(req, res) {
    try {
      if (!['admin', 'moderator', 'Admin', 'GameMaster'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para revisar reportes'
        });
      }
      
      const { reportId } = req.params;
      const { status, reviewNotes, actions = [] } = req.body;
      
      if (!['under_review', 'resolved', 'dismissed'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Estado no válido'
        });
      }
      
      const report = await Report.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Reporte no encontrado'
        });
      }
      
      if (report.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Este reporte ya está siendo revisado o ha sido resuelto'
        });
      }
      
      // Actualizar estado
      report.status = status;
      report.reviewedBy = req.user.userId;
      report.reviewedAt = new Date();
      if (reviewNotes) report.reviewNotes = reviewNotes;
      
      // Aplicar acciones si las hay
      if (actions.length > 0) {
        for (const action of actions) {
          await this.applyModerationAction(report, action, req.user.userId);
        }
      }
      
      await report.save();
      
      // Notificar al reportante vía Socket.IO
      if (global.io) {
        global.io.emit(`user:${report.reporter}:report_updated`, {
          reportId: report._id,
          status: report.status,
          reviewNotes: report.reviewNotes
        });
      }
      
      res.json({
        success: true,
        message: 'Reporte revisado correctamente',
        data: report
      });
    } catch (error) {
      console.error('Error reviewing report:', error);
      res.status(500).json({
        success: false,
        message: 'Error al revisar el reporte'
      });
    }
  }

  // Aplicar acción de moderación
  async applyModerationAction(report, action, moderatorId) {
    try {
      let targetUserId = null;
      
      // Obtener el usuario objetivo según el tipo
      switch (report.targetType) {
        case 'user':
          targetUserId = report.targetId;
          break;
        case 'message':
          const message = await ChatMessage.findById(report.targetId);
          targetUserId = message?.sender;
          break;
        case 'post':
          const post = await Post.findById(report.targetId);
          targetUserId = post?.author;
          break;
        case 'comment':
          const comment = await Comment.findById(report.targetId);
          targetUserId = comment?.author;
          break;
        case 'chatRoom':
          const chatRoom = await ChatRoom.findById(report.targetId);
          targetUserId = chatRoom?.createdBy;
          break;
      }
      
      if (!targetUserId) return;
      
      // Crear acción de moderación
      const moderationAction = new ModerationAction({
        targetUser: targetUserId,
        moderator: moderatorId,
        actionType: action.type,
        duration: action.duration,
        reason: action.reason || `Reporte ID: ${report._id}`,
        relatedReport: report._id
      });
      
      await moderationAction.save();
      
      // Agregar al reporte
      report.actionsTaken.push({
        type: action.type,
        appliedBy: moderatorId,
        duration: action.duration,
        reason: action.reason
      });
      
      // Ejecutar acción específica
      switch (action.type) {
        case 'delete_content':
          await this.deleteReportedContent(report);
          break;
        case 'hide_content':
          await this.hideReportedContent(report);
          break;
        case 'ban':
          await this.banUser(targetUserId, action.duration);
          break;
        case 'suspend':
          await this.suspendUser(targetUserId, action.duration);
          break;
      }
      
      // Notificar al usuario afectado
      if (global.io) {
        global.io.emit(`user:${targetUserId}:moderation_action`, {
          action: action.type,
          duration: action.duration,
          reason: action.reason,
          moderatedBy: moderatorId
        });
      }
    } catch (error) {
      console.error('Error applying moderation action:', error);
    }
  }

  // Eliminar contenido reportado
  async deleteReportedContent(report) {
    try {
      switch (report.targetType) {
        case 'message':
          await ChatMessage.findByIdAndUpdate(report.targetId, {
            isDeleted: true,
            deletedAt: new Date(),
            moderatedBy: report.reviewedBy,
            moderatedAt: new Date(),
            moderationReason: 'Eliminado por violación de políticas'
          });
          break;
        case 'post':
          await Post.findByIdAndUpdate(report.targetId, {
            isDeleted: true,
            deletedAt: new Date()
          });
          break;
        case 'comment':
          await Comment.findByIdAndUpdate(report.targetId, {
            isDeleted: true,
            deletedAt: new Date()
          });
          break;
      }
    } catch (error) {
      console.error('Error deleting reported content:', error);
    }
  }

  // Ocultar contenido reportado
  async hideReportedContent(report) {
    try {
      switch (report.targetType) {
        case 'message':
          await ChatMessage.findByIdAndUpdate(report.targetId, {
            isHidden: true,
            moderatedBy: report.reviewedBy,
            moderatedAt: new Date(),
            moderationReason: 'Ocultado por revisión'
          });
          break;
        case 'post':
          await Post.findByIdAndUpdate(report.targetId, {
            isHidden: true
          });
          break;
        case 'comment':
          await Comment.findByIdAndUpdate(report.targetId, {
            isHidden: true
          });
          break;
      }
    } catch (error) {
      console.error('Error hiding reported content:', error);
    }
  }

  // Suspender usuario
  async suspendUser(userId, duration) {
    try {
      await User.findByIdAndUpdate(userId, {
        isSuspended: true,
        suspendedUntil: duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null
      });
    } catch (error) {
      console.error('Error suspending user:', error);
    }
  }

  // Banear usuario
  async banUser(userId, duration) {
    try {
      await User.findByIdAndUpdate(userId, {
        isBanned: true,
        bannedUntil: duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null
      });
    } catch (error) {
      console.error('Error banning user:', error);
    }
  }

  // Obtener estadísticas de reportes
  async getReportStats(req, res) {
    try {
      if (!['admin', 'moderator', 'Admin', 'GameMaster'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver estadísticas'
        });
      }
      
      const stats = await Report.getStats();
      const categoryStats = await Report.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      const priorityStats = await Report.aggregate([
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 }
          }
        }
      ]);
      
      res.json({
        success: true,
        data: {
          overview: stats[0] || { total: 0, byStatus: [] },
          byCategory: categoryStats,
          byPriority: priorityStats
        }
      });
    } catch (error) {
      console.error('Error getting report stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas'
      });
    }
  }

  // Escalar reporte
  async escalateReport(req, res) {
    try {
      if (!['admin', 'moderator', 'Admin', 'GameMaster'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para escalar reportes'
        });
      }
      
      const { reportId } = req.params;
      const { reason, priority = 'critical' } = req.body;
      
      const report = await Report.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Reporte no encontrado'
        });
      }
      
      report.status = 'escalated';
      report.priority = priority;
      report.reviewNotes = `Escalado: ${reason}`;
      
      await report.save();
      
      // Notificar a todos los administradores
      if (global.io) {
        const admins = await User.find({ role: 'admin' });
        admins.forEach(admin => {
          global.io.emit(`admin:${admin._id}:report_escalated`, {
            reportId: report._id,
            reason,
            escalatedBy: req.user.username
          });
        });
      }
      
      res.json({
        success: true,
        message: 'Reporte escalado correctamente',
        data: report
      });
    } catch (error) {
      console.error('Error escalating report:', error);
      res.status(500).json({
        success: false,
        message: 'Error al escalar el reporte'
      });
    }
  }
}

module.exports = new ReportController();
