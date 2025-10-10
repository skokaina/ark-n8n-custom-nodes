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

exports['build:icons'] = series(copyAgentIcon, copyModelIcon, copyTeamIcon, copyEvaluationIcon);
exports.default = exports['build:icons'];
