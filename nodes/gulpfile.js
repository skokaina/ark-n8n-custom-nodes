const { src, dest, series } = require('gulp');
const rename = require('gulp-rename');

const iconsPath = process.env.ICONS_PATH || '../icons';

function copyIcons() {
  return src(`${iconsPath}/*.svg`)
    .pipe(dest('dist/nodes/ArkAgent'))
    .pipe(dest('dist/nodes/ArkModel'))
    .pipe(dest('dist/nodes/ArkTeam'))
    .pipe(dest('dist/nodes/ArkEvaluation'));
}

function copyAgentIcon() {
  return src(`${iconsPath}/ark-agent.svg`)
    .pipe(dest('dist/nodes/ArkAgent'));
}

function copyModelIcon() {
  return src(`${iconsPath}/ark-model.svg`)
    .pipe(dest('dist/nodes/ArkModel'));
}

function copyTeamIcon() {
  return src(`${iconsPath}/ark-team.svg`)
    .pipe(dest('dist/nodes/ArkTeam'));
}

function copyEvaluationIcon() {
  return src(`${iconsPath}/ark-evaluation.svg`)
    .pipe(dest('dist/nodes/ArkEvaluation'));
}

function copyAgentAdvancedIcon() {
  return src('nodes/ArkAgentAdvanced/ark-agent-advanced.svg')
    .pipe(dest('dist/nodes/ArkAgentAdvanced'));
}

function copyToolIcon() {
  return src('nodes/ArkTool/ark-tool.svg')
    .pipe(dest('dist/nodes/ArkTool'));
}

function copyModelSelectorIcon() {
  return src('nodes/ArkModelSelector/ark-model-selector.svg')
    .pipe(dest('dist/nodes/ArkModelSelector'));
}

function copyMemoryIcon() {
  return src('nodes/ArkMemory/ark-memory.svg')
    .pipe(dest('dist/nodes/ArkMemory'));
}

exports['build:icons'] = series(copyAgentIcon, copyModelIcon, copyTeamIcon, copyEvaluationIcon, copyAgentAdvancedIcon, copyToolIcon, copyModelSelectorIcon, copyMemoryIcon);
exports.default = exports['build:icons'];
